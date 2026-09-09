"""Metadata publication binds a frozen dose to its source without rewriting neural bytes."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import pandas as pd
from scipy import sparse
from connectome.artifact import write_binary
from connectome.retinal_map import build_retinal_map
from connectome.graph_audit import canonical_bytes
from test_retinal_map import fixture

ROOT = Path(__file__).resolve().parents[2]


class MetadataOnlyTests(unittest.TestCase):
    def test_cli_publishes_retinal_groups_and_rejects_relabelled_budget(self):
        annotations, manifest, matrix, profile, model = fixture()
        annotations = pd.concat([annotations, pd.DataFrame([
            dict(bodyId=202,type='DNleft',superclass='descending_neuron',somaSide='L')])],ignore_index=True)
        matrix = sparse.block_diag((matrix,sparse.csr_matrix((1,1))),format='csr')
        manifest['bodyIds'].append('202')
        registry = dict(provenance='synthetic retinal CLI fixture', bodies=dict(
            OLFACTORY_DN_LEFT=[202], OLFACTORY_DN_RIGHT=[201],
            EXCITATORY_LH_MOTOR={'L':[100],'R':[104]}, INHIBITORY_LH_MOTOR={'L':[100],'R':[104]},
            FLIGHT_DN_LEFT=[202],FLIGHT_DN_RIGHT=[201],LANDING_DN_LEFT=[202],LANDING_DN_RIGHT=[201],
            TARSAL_GRN_IDS=[100],BM_TASTE_IDS=[104],GNG_INTERNEURON_IDS=[100],PROBOSCIS_MN_IDS=[201]))
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            script=root/'prepare-graph.py'
            shutil.copyfile(ROOT/'scripts/prepare-graph.py',script)
            shutil.copytree(ROOT/'scripts/connectome',root/'connectome',ignore=shutil.ignore_patterns('__pycache__'))
            source,output=root/'source',root/'output'
            source.mkdir(); output.mkdir()
            annotations.to_feather(source/'body-annotations.feather')
            annotation_hash=hashlib.sha256((source/'body-annotations.feather').read_bytes()).hexdigest()
            graph_hash=write_binary(output/'graph.bin',matrix)
            manifest['sources'][0]['sha256']=annotation_hash
            manifest.update(graphHash=graph_hash,neuronCount=len(manifest['bodyIds']),edgeCount=matrix.nnz,
                            exporterHash='original-extractor',exporterRevision='original-revision',fallbackCount=0,missingAnnotations=0)
            manifest['retinalBudget'].update(sourceGraphHash=graph_hash,annotationHash=annotation_hash)
            registry['retinalBudget']=manifest['retinalBudget'].copy()
            model.update(graphHash=graph_hash,annotationHash=annotation_hash)
            retinal,_=build_retinal_map(annotations,manifest,matrix,annotation_hash,profile,model)
            (output/'retinal-map.json').write_bytes(canonical_bytes(retinal))
            (root/'profile.json').write_text(json.dumps(profile))
            (output/'manifest.json').write_text(json.dumps(manifest))
            (root/'connectome/pathways.json').write_text(json.dumps(registry))
            original=(output/'graph.bin').read_bytes()
            original_mtime=(output/'graph.bin').stat().st_mtime_ns
            retinal_bytes=(output/'retinal-map.json').read_bytes()
            command=[sys.executable,str(script),'--metadata-only','--source',str(source),'--output',str(output),'--retinal-profile',str(root/'profile.json')]
            result=subprocess.run(command,capture_output=True,text=True,cwd=ROOT)
            self.assertEqual(result.returncode,0,result.stderr)
            published=json.loads((output/'manifest.json').read_text())
            self.assertNotIn('visionInput',published)
            self.assertEqual(published['retinalBudget'],registry['retinalBudget'])
            groups={g['id']:g for g in published['groups']}
            for eye in ('L','R'):
                self.assertEqual(groups['vision'+eye]['indices'],[e['index'] for e in retinal['entries'] if e['eye']==eye])
            self.assertEqual(len(groups),16)
            self.assertEqual(published['extractionExporterHash'],'original-extractor')
            self.assertEqual((output/'graph.bin').read_bytes(),original)
            self.assertEqual((output/'graph.bin').stat().st_mtime_ns,original_mtime)
            self.assertEqual((output/'retinal-map.json').read_bytes(),retinal_bytes)
            frozen=(output/'manifest.json').read_bytes()
            (output/'retinal-map.json').write_text(json.dumps(retinal))
            rejected=subprocess.run(command,capture_output=True,text=True,cwd=ROOT)
            self.assertNotEqual(rejected.returncode,0)
            self.assertIn('canonical JSON bytes',rejected.stderr)
            self.assertEqual((output/'manifest.json').read_bytes(),frozen)
            (output/'retinal-map.json').write_bytes(retinal_bytes)
            # A different graph cannot silently inherit the old archive's aggregate dose.
            registry['retinalBudget']['sourceGraphHash']='f'*64
            (root/'connectome/pathways.json').write_text(json.dumps(registry))
            rejected=subprocess.run(command,capture_output=True,text=True,cwd=ROOT)
            self.assertNotEqual(rejected.returncode,0)
            self.assertIn('Retinal budget must match',rejected.stderr)
            self.assertEqual((output/'manifest.json').read_bytes(),frozen)
            registry['retinalBudget']['sourceGraphHash']=graph_hash
            registry['retinalBudget']['sourceMapHash']='f'*64
            (root/'connectome/pathways.json').write_text(json.dumps(registry))
            rejected=subprocess.run(command,capture_output=True,text=True,cwd=ROOT)
            self.assertNotEqual(rejected.returncode,0)
            self.assertIn('Retinal map identity differs',rejected.stderr)
            self.assertEqual((output/'manifest.json').read_bytes(),frozen)

            # Full extraction can bootstrap a new output with an explicit retinal artifact.
            from connectome.extract import extract
            nt=pd.DataFrame({'bodyId':annotations.bodyId,'predicted_nt':['gaba' if b==200 else 'acetylcholine' for b in annotations.bodyId]})
            coo=matrix.tocoo()
            weights=pd.DataFrame({'body_pre':[int(manifest['bodyIds'][i]) for i in coo.col],
                                  'body_post':[int(manifest['bodyIds'][i]) for i in coo.row],
                                  'weight':[5]*len(coo.data)})
            nt.to_feather(source/'body-neurotransmitters.feather')
            weights.to_feather(source/'connectome-weights.feather')
            sources=[dict(file=name,sha256=hashlib.sha256((source/name).read_bytes()).hexdigest())
                     for name in ['body-annotations.feather','body-neurotransmitters.feather','connectome-weights.feather']]
            (source/'sources.json').write_text(json.dumps(sources))
            extracted=extract(annotations,nt,weights)
            new_hash=write_binary(root/'expected.bin',extracted['matrix'])
            self.assertEqual(list(map(str,extracted['bodies'])),manifest['bodyIds'])
            manifest['graphHash']=new_hash
            manifest['retinalBudget'].update(sourceGraphHash=new_hash)
            registry['retinalBudget']=manifest['retinalBudget'].copy()
            model['graphHash']=new_hash
            retinal,_=build_retinal_map(annotations,manifest,extracted['matrix'],annotation_hash,profile,model)
            (root/'retinal.json').write_bytes(canonical_bytes(retinal))
            (root/'connectome/pathways.json').write_text(json.dumps(registry))
            fresh=root/'fresh'
            command=[sys.executable,str(script),'--source',str(source),'--output',str(fresh),
                     '--retinal-profile',str(root/'profile.json'),'--retinal-map',str(root/'retinal.json')]
            result=subprocess.run(command,capture_output=True,text=True,cwd=ROOT)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual((fresh/'graph.bin').read_bytes(),(root/'expected.bin').read_bytes())
            self.assertEqual((fresh/'retinal-map.json').read_bytes(),(root/'retinal.json').read_bytes())
            original_fresh={name:(fresh/name).read_bytes() for name in ['graph.bin','manifest.json','retinal-map.json']}
            registry['retinalBudget']['sourceGraphHash']='f'*64
            (root/'connectome/pathways.json').write_text(json.dumps(registry))
            rejected=subprocess.run(command,capture_output=True,text=True,cwd=ROOT)
            self.assertNotEqual(rejected.returncode,0)
            self.assertIn('Retinal budget must match',rejected.stderr)
            self.assertEqual({name:(fresh/name).read_bytes() for name in original_fresh},original_fresh)


if __name__ == '__main__':
    unittest.main()
