"""Retinal geometry, source identity and shared-dose contracts; no neural tuning."""
import sys
import unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))


def lattice(radius=3):
    return [dict(q=q,r=r,x=q+r/2,y=r*np.sqrt(3)/2)
            for r in range(-radius,radius+1) for q in range(-radius,radius+1) if abs(q+r)<=radius]


class GeometryTests(unittest.TestCase):
    def test_local_triangle_reconstructs_point_and_vertex_has_no_false_neighbors(self):
        from connectome.retinal_map import barycentric_taps
        cells=lattice()
        point=[.35,.3*np.sqrt(3)/2]
        taps=barycentric_taps(point,cells)
        got={(cells[i]['q'],cells[i]['r']):w for i,w in taps}
        self.assertEqual(set(got),{(0,0),(1,0),(0,1)})
        np.testing.assert_allclose([got[(0,0)],got[(1,0)],got[(0,1)]],[.5,.2,.3],rtol=0,atol=1e-14)
        np.testing.assert_allclose(np.array([[cells[i]['x'],cells[i]['y']] for i,_ in taps]).T @ [w for _,w in taps],point,rtol=0,atol=1e-14)
        vertex=next(i for i,c in enumerate(cells) if c['q']==3 and c['r']==0)
        self.assertEqual(barycentric_taps([3,0],cells),[(vertex,1.)])
        with self.assertRaisesRegex(ValueError,'outside'):
            barycentric_taps([4,0],cells)

    def test_full_source_union_keeps_family_columns_colocated_and_preserves_axes(self):
        import pandas as pd
        from connectome.retinal_map import source_registration, registered_position
        rows=[]
        for side in ('L','R'):
            for family,points in [('Tm2',[(0,0),(2,0),(0,2)]),('Tm20',[(0,0),(2,0),(0,2),(4,2)])]:
                for h1,h2 in points:
                    rows.append(dict(type=family,somaSide=side,assignedOlHex1=h1,assignedOlHex2=h2))
        source=pd.DataFrame(rows)
        transforms=source_registration(source,3)
        # Same column has one position regardless of which family owns the cell.
        shared=[registered_position([0,0],transforms[side]) for side in ('L','R')]
        self.assertAlmostEqual(shared[0][0],-shared[1][0])
        self.assertAlmostEqual(shared[0][1],shared[1][1])
        origin=registered_position([1,1],transforms['R'])
        higher=registered_position([1,2],transforms['R'])
        self.assertLess(higher[1],origin[1])
        self.assertGreater(registered_position([2,1],transforms['R'])[0],origin[0])
        self.assertEqual(transforms,source_registration(source.iloc[::-1],3))
        # The unselected Tm20 extreme still controls the common eye registration.
        self.assertEqual(transforms['R']['cartesianBounds'],[[0.,0.],[5.,np.sqrt(3)]])


def fixture(tm20_points=4):
    import pandas as pd
    from scipy import sparse
    rows=[]
    selected=[]
    for family in ('Tm2','Tm20'):
        for side in ('L','R'):
            for p,(h1,h2) in enumerate([(0,0),(2,0),(0,2),(2,2)]):
                body=100+len(rows)
                rows.append(dict(bodyId=body,type=family,flywireType=family,superclass='ol_intrinsic',somaSide=side,
                                 assignedOlHex1=float(h1),assignedOlHex2=float(h2)))
                if family=='Tm2' or p<tm20_points: selected.append(body)
    rows += [dict(bodyId=200,type='LC4',flywireType='LC4',superclass='visual_projection',somaSide='R',assignedOlHex1=np.nan,assignedOlHex2=np.nan),
             dict(bodyId=201,type='DNx',flywireType='DNx',superclass='descending_neuron',somaSide='R',assignedOlHex1=np.nan,assignedOlHex2=np.nan)]
    bodies=selected+[200,201]
    matrix=sparse.lil_matrix((len(bodies),len(bodies)))
    matrix[-2,:-2]=1
    matrix[-1,-2]=-1
    manifest=dict(bodyIds=list(map(str,bodies)),graphHash='g',sources=[dict(file='body-annotations.feather',sha256='a')],
                  motor=dict(dnR=[len(bodies)-1]),pathways={},groups=[],
                  retinalBudget=dict(sourceGraphHash='g',annotationHash='a',sourceMapHash='b'*64,weightSum=8.))
    profile=dict(status='provisional',semantic=dict(opticalModelVersion='test-optics',
        capture=dict(width=32,height=32,verticalFovDegrees=157,aspect=1,nearMetres=.001,farMetres=10,distortion=3.8,zoom=2.72),
        layout=dict(radius=3,cells=lattice()),eyeOrder=['L','R'],rgbOrder=['R','G','B'],imageAxes=dict(x='right',y='down'),rigSha256='r',
        photometry=dict(encoding='linear-RGB8',exposure=1,pooling='GPU-float32-mean',quantization='floor(255*clamp(mean,0,1)+0.5)',toneMapping='none')),
        rig=dict(rigSha256='r',units='metres',eyes=[dict(side=side,positionMetres=[.1 if side=='L' else -.1,.1,.1],
            cameraToBodyQuaternion=[0,(-1 if side=='L' else 1)*np.sin(3*np.pi/8),0,np.cos(3*np.pi/8)]) for side in ('L','R')]),
        provenance=dict(sourceSha256={'fixture':'first'}))
    import json,hashlib
    rig_json=json.dumps({k:v for k,v in profile['rig'].items() if k!='rigSha256'},separators=(',',':'))
    profile['rigCanonicalJson']=rig_json
    profile['rig']['rigSha256']=profile['semantic']['rigSha256']=hashlib.sha256(rig_json.encode()).hexdigest()
    model=dict(version=1,families=['Tm2','Tm20'],rgbCoefficients=[[.2126,.7152,.0722],[0,0,1]],
               transfer='q/(q+0.5)',baseline=0,graphHash='g',annotationHash='a',dose=dict(gainMaximum=3))
    return pd.DataFrame(rows),manifest,matrix.tocsr(),profile,model


class RetinalExportTests(unittest.TestCase):
    def test_sparse_source_map_shares_one_budget_and_bounds_mixed_input(self):
        from connectome.retinal_map import build_retinal_map, retinal_currents
        annotations,manifest,matrix,profile,model=fixture(tm20_points=1)
        mapping,report=build_retinal_map(annotations,manifest,matrix,'a',profile,model)
        self.assertLess(mapping['budget']['globalScale'],1)
        self.assertLessEqual(mapping['budget']['totalWeight'],8)
        self.assertAlmostEqual(mapping['budget']['familyWeightSums']['Tm2'],mapping['budget']['familyWeightSums']['Tm20'])
        rgb=np.full((2,37,3),255,dtype=np.uint8)
        currents=retinal_currents(mapping,rgb,3)
        self.assertLessEqual(currents.max(),3)
        self.assertLessEqual(currents.sum(),16)
        self.assertTrue(all(1<=len(e['taps'])<=3 for e in mapping['entries']))
        self.assertTrue(any(not v for family in mapping['support'].values() for eye in family.values() for v in eye))
        cells={c['bodyId']:c for c in report['cells']}
        self.assertEqual(cells['100']['position'],cells['108']['position'])
        self.assertEqual(cells['100']['readoutPath'],['100','200','201'])
        # Graph selection changes cannot change the full-source registration.
        a2,m2,g2,p2,c2=fixture(tm20_points=4)
        other,_=build_retinal_map(a2,m2,g2,'a',p2,c2)
        self.assertEqual(mapping['registration']['eyes'],other['registration']['eyes'])

    def test_identity_and_rejected_coefficients_do_not_create_fallback_channels(self):
        from copy import deepcopy
        from connectome.retinal_map import build_retinal_map, validate_retinal_map
        a,m,g,p,c=fixture()
        mapping,_=build_retinal_map(a,m,g,'a',p,c)
        changed=deepcopy(p)
        changed['provenance']['sourceSha256']['fixture']='comment-only change'
        same,_=build_retinal_map(a,m,g,'a',changed,c)
        self.assertEqual(mapping,same)
        changed['rig']['eyes'][0]['positionMetres'][1]+=100
        with self.assertRaisesRegex(ValueError,'Rig contents'):
            validate_retinal_map(mapping,m,changed,c)
        changed=deepcopy(p)
        changed['semantic']['capture']['zoom']=2.5
        with self.assertRaisesRegex(ValueError,'identity'):
            validate_retinal_map(mapping,m,changed,c)
        for coefficients in [[[.2126,.7152,.0722],[-.5,0,1.5]],[[.2126,.7152,.0722],[0,np.nan,1]],[[.2126,.7152,.0722],[.2126,.7152,.0722]]]:
            wrong=deepcopy(c);wrong['rgbCoefficients']=coefficients
            with self.assertRaises(ValueError):build_retinal_map(a,m,g,'a',p,wrong)
        with self.assertRaisesRegex(ValueError,'required'):
            build_retinal_map(a,m,g,'a',p,None)
        for change in ('negative','nonfinite','motor','color','layout'):
            wrong=deepcopy(mapping)
            if change=='negative':wrong['entries'][0]['taps'][0]=(wrong['entries'][0]['taps'][0][0],-.1)
            if change=='nonfinite':wrong['entries'][0]['taps'][0]=(wrong['entries'][0]['taps'][0][0],np.nan)
            if change=='motor':wrong['entries'][0].update(index=len(m['bodyIds'])-1,bodyId='201')
            if change=='color':wrong['identities']['colorModelHash']='wrong'
            if change=='layout':wrong['identities']['layoutHash']='wrong'
            with self.assertRaises(ValueError):validate_retinal_map(wrong,m,p,c)

    def test_matched_brightness_color_swap_preserves_actual_supported_dose(self):
        from connectome.retinal_map import build_retinal_map, retinal_currents
        a,m,g,p,c=fixture()
        mapping,_=build_retinal_map(a,m,g,'a',p,c)
        rgb=np.zeros((2,37,3),dtype=np.uint8)
        # Only common support permits the same two colors to swap with equal channel dose.
        pairs=[]
        for eye,side in enumerate(('L','R')):
            common=[i for i in range(37) if all(mapping['support'][f][side][i] for f in ('Tm2','Tm20'))]
            self.assertGreaterEqual(len(common),2)
            x,y=common[:2];pairs.append((x,y))
            rgb[eye,x]=[100,100,100];rgb[eye,y]=[35,117,123]
        first=retinal_currents(mapping,rgb)
        for eye,(x,y) in enumerate(pairs):rgb[eye,[x,y]]=rgb[eye,[y,x]]
        second=retinal_currents(mapping,rgb)
        brightness=np.array([e['channel']==0 for e in mapping['entries']])
        np.testing.assert_allclose(first[brightness],second[brightness],rtol=0,atol=1e-12)
        self.assertGreater(np.abs(first[~brightness]-second[~brightness]).max(),0)
        for eye in ('L','R'):
            selected=np.array([e['eye']==eye for e in mapping['entries']])
            self.assertAlmostEqual(first[selected].sum(),second[selected].sum(),places=12)
        left=np.array([e['eye']=='L' for e in mapping['entries']])
        self.assertAlmostEqual(first[left].sum(),first[~left].sum(),places=12)
        black=np.zeros_like(rgb)
        self.assertEqual(float(retinal_currents(mapping,black).sum()),0)
        red=np.zeros_like(rgb);red[:,:,0]=255
        self.assertEqual(float(retinal_currents(mapping,red)[~brightness].sum()),0)
