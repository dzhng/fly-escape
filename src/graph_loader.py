"""
Load MaleCNS connectome and extract motor1hop subgraph with olfactory pathways.

The motor1hop subgraph includes:
- DN (descending neurons) and MN (motor neurons)
- 1-hop neighbors with weight threshold
- Olfactory pathway neurons (ORNs, PNs, LH, MBONs)

Synapse sign is determined by neurotransmitter:
- ACh (acetylcholine): excitatory (+1)
- GABA: inhibitory (-1)
- glutamate: inhibitory (-1)
- histamine: inhibitory (-1)
- Modulators (dopamine, octopamine, serotonin): dropped
"""

import numpy as np
import pandas as pd
import pyarrow.feather as feather
from scipy import sparse
from pathlib import Path
from typing import Tuple, Dict, Set, Optional, List
from tqdm import tqdm


NT_SIGN = {
    "acetylcholine": +1,
    "gaba": -1,
    "glutamate": -1,
    "histamine": -1,
}

MODULATORS = {"dopamine", "octopamine", "serotonin"}

FRUIT_GLOMERULI = ["DM1", "DM2", "DM3", "DM4", "DM5", "DL1", "DL5", "DC2", "VA6"]


class MaleCNSGraph:
    """MaleCNS connectome with NT-signed synapses."""
    
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.annotations: pd.DataFrame = None
        self.neurotransmitters: pd.DataFrame = None
        self.weights: pd.DataFrame = None
        self.body_to_idx: Dict[int, int] = {}
        self.idx_to_body: Dict[int, int] = {}
        self.adjacency: sparse.csr_matrix = None
        self.n_neurons: int = 0
        self.dn_bodies: Set[int] = set()
        self.mn_bodies: Set[int] = set()
        self.olfactory_bodies: Set[int] = set()
        
    def load(self) -> "MaleCNSGraph":
        """Load all feather files."""
        print("Loading MaleCNS v1.0 connectome...")
        
        ann_path = self.data_dir / "body-annotations.feather"
        nt_path = self.data_dir / "body-neurotransmitters.feather"
        wt_path = self.data_dir / "connectome-weights.feather"
        
        print(f"  Loading annotations from {ann_path.name}...")
        self.annotations = feather.read_feather(ann_path)
        print(f"    {len(self.annotations):,} bodies")
        
        print(f"  Loading neurotransmitters from {nt_path.name}...")
        self.neurotransmitters = feather.read_feather(nt_path)
        print(f"    {len(self.neurotransmitters):,} rows")
        
        print(f"  Loading connectome weights from {wt_path.name}...")
        self.weights = feather.read_feather(wt_path)
        print(f"    {len(self.weights):,} edges")
        
        return self
    
    def build_nt_sign_map(self, body_ids: Set[int]) -> Dict[int, int]:
        """Build a map of bodyId -> NT sign for a set of neurons."""
        sign_map = {}
        
        nt_col = "consensus_nt" if "consensus_nt" in self.neurotransmitters.columns else "predicted_nt"
        body_col = "body" if "body" in self.neurotransmitters.columns else "bodyId"
        
        nt_df = self.neurotransmitters[self.neurotransmitters[body_col].isin(body_ids)]
        
        for _, row in nt_df.iterrows():
            body_id = row[body_col]
            nt = str(row[nt_col]).lower() if pd.notna(row[nt_col]) else ""
            if nt in MODULATORS:
                sign_map[body_id] = 0
            else:
                sign_map[body_id] = NT_SIGN.get(nt, 1)
        
        return sign_map
    
    def get_dn_mn_bodies(self) -> Tuple[Set[int], Set[int]]:
        """Get body IDs for descending neurons (DN) and motor neurons (MN)."""
        dn_bodies = set()
        mn_bodies = set()
        
        for _, row in self.annotations.iterrows():
            body_id = row["bodyId"]
            cell_type = str(row["type"]).upper() if pd.notna(row["type"]) else ""
            
            if cell_type.startswith("DN"):
                dn_bodies.add(body_id)
            elif cell_type.startswith("MN"):
                mn_bodies.add(body_id)
        
        return dn_bodies, mn_bodies
    
    def get_olfactory_pathway_bodies(self) -> Dict[str, Set[int]]:
        """Get body IDs for olfactory pathway neurons."""
        result = {
            "ORN": set(),
            "PN": set(),
            "LH": set(),
            "MBON": set(),
        }
        
        types = self.annotations["type"].astype(str)
        
        for prefix in FRUIT_GLOMERULI:
            orn_mask = types.str.startswith(f"ORN_{prefix}")
            pn_mask = types.str.contains(f"{prefix}_.*PN", regex=True, na=False)
            
            result["ORN"].update(self.annotations.loc[orn_mask, "bodyId"].tolist())
            result["PN"].update(self.annotations.loc[pn_mask, "bodyId"].tolist())
        
        lh_mask = types.str.contains("^LH|_LH", regex=True, na=False)
        result["LH"].update(self.annotations.loc[lh_mask, "bodyId"].tolist())
        
        mbon_mask = types.str.contains("^MBON", regex=True, na=False)
        result["MBON"].update(self.annotations.loc[mbon_mask, "bodyId"].tolist())
        
        return result
    
    def extract_motor1hop(
        self,
        min_weight: int = 5,
        target_neurons: int = 65000,
        include_olfactory: bool = True,
    ) -> Tuple[sparse.csr_matrix, Dict[int, int], Dict[int, int]]:
        """
        Extract motor1hop subgraph with olfactory pathways.
        
        Args:
            min_weight: Minimum synapse weight to include
            target_neurons: Target subgraph size
            include_olfactory: Include olfactory pathway neurons
        
        Returns:
            adjacency: Signed sparse adjacency matrix
            body_to_idx: Map from bodyId to matrix index
            idx_to_body: Map from matrix index to bodyId
        """
        print("\nExtracting motor1hop subgraph with olfactory pathways...")
        
        dn_bodies, mn_bodies = self.get_dn_mn_bodies()
        print(f"  Found {len(dn_bodies):,} DN, {len(mn_bodies):,} MN")
        
        self.dn_bodies = dn_bodies
        self.mn_bodies = mn_bodies
        
        seed_bodies = dn_bodies | mn_bodies
        
        if include_olfactory:
            olf_bodies = self.get_olfactory_pathway_bodies()
            print(f"  Olfactory: {len(olf_bodies['ORN'])} ORNs, {len(olf_bodies['PN'])} PNs, "
                  f"{len(olf_bodies['LH'])} LH, {len(olf_bodies['MBON'])} MBONs")
            
            self.olfactory_bodies = olf_bodies["ORN"] | olf_bodies["PN"] | olf_bodies["LH"]
            seed_bodies = seed_bodies | self.olfactory_bodies
            seed_bodies = seed_bodies | set(list(olf_bodies["MBON"])[:200])
        
        print(f"  Seed neurons: {len(seed_bodies):,}")
        
        print(f"  Filtering edges with weight >= {min_weight}...")
        strong_weights = self.weights[self.weights["weight"] >= min_weight]
        print(f"    {len(strong_weights):,} strong edges")
        
        weights_arr = strong_weights.values
        pre_bodies = weights_arr[:, 0]
        post_bodies = weights_arr[:, 1]
        weights_vals = weights_arr[:, 2]
        
        seed_list = np.array(list(seed_bodies))
        pre_is_seed = np.isin(pre_bodies, seed_list)
        post_is_seed = np.isin(post_bodies, seed_list)
        seed_mask = pre_is_seed | post_is_seed
        
        relevant_idx = np.where(seed_mask)[0]
        print(f"  Found {len(relevant_idx):,} edges touching seed neurons")
        
        neighbor_counts = {}
        for idx in relevant_idx:
            pre = pre_bodies[idx]
            post = post_bodies[idx]
            w = weights_vals[idx]
            
            if pre in seed_bodies:
                if post not in seed_bodies:
                    if post not in neighbor_counts:
                        neighbor_counts[post] = 0
                    neighbor_counts[post] += w
            if post in seed_bodies:
                if pre not in seed_bodies:
                    if pre not in neighbor_counts:
                        neighbor_counts[pre] = 0
                    neighbor_counts[pre] += w
        
        sorted_neighbors = sorted(neighbor_counts.items(), key=lambda x: -x[1])
        max_extra = max(0, target_neurons - len(seed_bodies))
        selected_neighbors = set(n for n, w in sorted_neighbors[:max_extra])
        
        all_bodies = seed_bodies | selected_neighbors
        print(f"  Selected {len(all_bodies):,} neurons for subgraph")
        
        body_list = sorted(all_bodies)
        body_to_idx = {b: i for i, b in enumerate(body_list)}
        idx_to_body = {i: b for i, b in enumerate(body_list)}
        n = len(body_list)
        
        print("  Building NT sign map...")
        sign_map = self.build_nt_sign_map(all_bodies)
        
        print("  Building signed adjacency matrix...")
        rows = []
        cols = []
        data = []
        
        for idx in tqdm(relevant_idx, desc="  Processing edges"):
            pre = pre_bodies[idx]
            post = post_bodies[idx]
            w = weights_vals[idx]
            
            if pre in body_to_idx and post in body_to_idx:
                sign = sign_map.get(pre, 1)
                if sign == 0:
                    continue
                rows.append(body_to_idx[pre])
                cols.append(body_to_idx[post])
                data.append(w * sign)
        
        adjacency = sparse.csr_matrix((data, (rows, cols)), shape=(n, n))
        nnz = adjacency.nnz
        
        print(f"  Adjacency: {n:,} neurons, {nnz:,} signed edges")
        
        if data:
            data_arr = np.array(data)
            pos_edges = np.sum(data_arr > 0)
            neg_edges = np.sum(data_arr < 0)
            print(f"    Excitatory edges: {pos_edges:,}")
            print(f"    Inhibitory edges: {neg_edges:,}")
        
        self.body_to_idx = body_to_idx
        self.idx_to_body = idx_to_body
        self.adjacency = adjacency
        self.n_neurons = n
        
        return adjacency, body_to_idx, idx_to_body
    
    def get_body_side(self, body_id: int) -> str:
        """Get L/R side for a body."""
        if "somaSide" in self.annotations.columns:
            rows = self.annotations[self.annotations["bodyId"] == body_id]
            if len(rows) > 0:
                side = rows.iloc[0]["somaSide"]
                if pd.notna(side):
                    return str(side).upper()
        return ""


def load_motor1hop(data_dir: Path) -> MaleCNSGraph:
    """Convenience function to load and extract motor1hop."""
    graph = MaleCNSGraph(data_dir)
    graph.load()
    graph.extract_motor1hop()
    return graph


def get_visual_neurons(annotations: pd.DataFrame) -> Dict[str, Set[int]]:
    """Get body IDs for visual pathway neurons.
    
    SPIKE FINDING: Visual neuron availability in MaleCNS:
    - LC (Lobula Columnar): 4,257 total - looming detectors
      - LC4: 126 (100% in motor1hop) - ESCAPE looming → DNp04 (Giant Fiber)
      - LC6: 124 (60% in motor1hop) - also escape-related
      - LC16: 182 (6% in motor1hop) - LANDING looming → DNp43 (NOT in motor1hop)
    - LPLC: 417 (100% in motor1hop) - visual processing
    - R7/R8: 2,714 total - photoreceptors (NOT in motor1hop, 0 direct DN connections)
    
    For pure-graph visual processing, LC→DN is the viable path.
    R7/R8→DN requires 3+ hops through medulla - too large for subgraph.
    """
    types = annotations["type"].astype(str)
    
    return {
        "LC": set(annotations.loc[types.str.match('^LC', na=False), "bodyId"]),
        "LPLC": set(annotations.loc[types.str.contains('LPLC', na=False), "bodyId"]),
        "R7": set(annotations.loc[types.str.match('^R7', na=False), "bodyId"]),
        "R8": set(annotations.loc[types.str.match('^R8', na=False), "bodyId"]),
        "VPN": set(annotations.loc[types.str.contains('VPN', na=False), "bodyId"]),
    }


class VisualMotorGraph(MaleCNSGraph):
    """
    Extended MaleCNS graph with visual LC neurons included for pure-graph looming.
    
    SPIKE LEARNINGS:
    - LC4→DNp04 is the Giant Fiber ESCAPE pathway (11,597 total weight)
    - LC4 neurons are 100% included when using visual_motor extraction
    - LC16→DNp43 (landing) is NOT well-connected in motor1hop (only 6% of LC16)
    - Landing still requires external loom calculation → soft stub
    
    Key difference from motor1hop:
    - Explicitly includes ALL LC neurons with direct DN/MN connections
    - Enables pure-graph escape-looming response
    """
    
    def __init__(self, data_dir: Path):
        super().__init__(data_dir)
        self.lc_bodies: Set[int] = set()
        self.lplc_bodies: Set[int] = set()
        self.escape_dn_bodies: Set[int] = set()  # DNp04, etc.
    
    def extract_visual_motor(
        self,
        min_weight: int = 5,
        target_neurons: int = 70000,  # Slightly larger to accommodate visual neurons
        include_olfactory: bool = True,
    ) -> Tuple[sparse.csr_matrix, Dict[int, int], Dict[int, int]]:
        """
        Extract visual+motor subgraph with LC looming detectors.
        
        Like motor1hop but explicitly includes:
        - ALL LC neurons with direct DN/MN connections (escape looming)
        - ALL LPLC neurons
        - Olfactory pathway (if enabled)
        
        SPIKE NOTE: This enables pure-graph escape response via LC4→DNp04.
        Landing via LC16→DNp43 is NOT well-supported (requires separate subgraph).
        
        Returns:
            adjacency: Signed sparse adjacency matrix
            body_to_idx: Map from bodyId to matrix index  
            idx_to_body: Map from matrix index to bodyId
        """
        print("\n=== Extracting visual_motor subgraph ===")
        print("SPIKE: Includes LC→DN escape pathway for pure-graph looming")
        
        # Get motor neurons (same as motor1hop)
        dn_bodies, mn_bodies = self.get_dn_mn_bodies()
        print(f"  DN: {len(dn_bodies):,}, MN: {len(mn_bodies):,}")
        
        self.dn_bodies = dn_bodies
        self.mn_bodies = mn_bodies
        
        # Get visual neurons
        visual = get_visual_neurons(self.annotations)
        self.lc_bodies = visual["LC"]
        self.lplc_bodies = visual["LPLC"]
        print(f"  LC: {len(self.lc_bodies):,}, LPLC: {len(self.lplc_bodies):,}")
        
        # Find LC neurons with direct DN/MN output (these drive motor behavior)
        strong_weights = self.weights[self.weights["weight"] >= min_weight]
        motor_targets = dn_bodies | mn_bodies
        lc_to_motor = strong_weights[
            (strong_weights["body_pre"].isin(self.lc_bodies)) & 
            (strong_weights["body_post"].isin(motor_targets))
        ]
        lc_direct_to_motor = set(lc_to_motor["body_pre"])
        print(f"  LC with direct DN/MN output: {len(lc_direct_to_motor):,}")
        
        # Find escape DNs (DNp04 = Giant Fiber target)
        types = self.annotations["type"].astype(str)
        escape_dns = set(self.annotations.loc[
            types.str.contains('DNp04|DNp01|DNp02|DNp03|DNp05|DNp11', na=False), 
            "bodyId"
        ])
        self.escape_dn_bodies = escape_dns & dn_bodies
        print(f"  Escape DNs (DNp01-05, DNp11): {len(self.escape_dn_bodies):,}")
        
        # Build seed neurons: motor + visual + olfactory
        seed_bodies = dn_bodies | mn_bodies | lc_direct_to_motor | self.lplc_bodies
        
        if include_olfactory:
            olf_bodies = self.get_olfactory_pathway_bodies()
            print(f"  Olfactory: {len(olf_bodies['ORN'])} ORNs, {len(olf_bodies['LH'])} LH")
            self.olfactory_bodies = olf_bodies["ORN"] | olf_bodies["PN"] | olf_bodies["LH"]
            seed_bodies = seed_bodies | self.olfactory_bodies
            seed_bodies = seed_bodies | set(list(olf_bodies["MBON"])[:200])
        
        print(f"  Total seed neurons: {len(seed_bodies):,}")
        
        # Find 1-hop neighbors (same algorithm as motor1hop)
        print(f"  Filtering edges with weight >= {min_weight}...")
        
        weights_arr = strong_weights.values
        pre_bodies = weights_arr[:, 0]
        post_bodies = weights_arr[:, 1]
        weights_vals = weights_arr[:, 2]
        
        seed_list = np.array(list(seed_bodies))
        pre_is_seed = np.isin(pre_bodies, seed_list)
        post_is_seed = np.isin(post_bodies, seed_list)
        seed_mask = pre_is_seed | post_is_seed
        
        relevant_idx = np.where(seed_mask)[0]
        print(f"  Found {len(relevant_idx):,} edges touching seed neurons")
        
        # Count neighbor connections
        neighbor_counts = {}
        for idx in relevant_idx:
            pre = pre_bodies[idx]
            post = post_bodies[idx]
            w = weights_vals[idx]
            
            if pre in seed_bodies:
                if post not in seed_bodies:
                    if post not in neighbor_counts:
                        neighbor_counts[post] = 0
                    neighbor_counts[post] += w
            if post in seed_bodies:
                if pre not in seed_bodies:
                    if pre not in neighbor_counts:
                        neighbor_counts[pre] = 0
                    neighbor_counts[pre] += w
        
        # Select top neighbors by weight
        sorted_neighbors = sorted(neighbor_counts.items(), key=lambda x: -x[1])
        max_extra = max(0, target_neurons - len(seed_bodies))
        selected_neighbors = set(n for n, w in sorted_neighbors[:max_extra])
        
        all_bodies = seed_bodies | selected_neighbors
        print(f"  Selected {len(all_bodies):,} neurons for subgraph")
        
        # Build adjacency matrix (same as motor1hop)
        body_list = sorted(all_bodies)
        body_to_idx = {b: i for i, b in enumerate(body_list)}
        idx_to_body = {i: b for i, b in enumerate(body_list)}
        n = len(body_list)
        
        print("  Building NT sign map...")
        sign_map = self.build_nt_sign_map(all_bodies)
        
        print("  Building signed adjacency matrix...")
        rows = []
        cols = []
        data = []
        
        for idx in tqdm(relevant_idx, desc="  Processing edges"):
            pre = pre_bodies[idx]
            post = post_bodies[idx]
            w = weights_vals[idx]
            
            if pre in body_to_idx and post in body_to_idx:
                sign = sign_map.get(pre, 1)
                if sign == 0:
                    continue
                rows.append(body_to_idx[pre])
                cols.append(body_to_idx[post])
                data.append(w * sign)
        
        adjacency = sparse.csr_matrix((data, (rows, cols)), shape=(n, n))
        nnz = adjacency.nnz
        
        print(f"  Adjacency: {n:,} neurons, {nnz:,} signed edges")
        
        if data:
            data_arr = np.array(data)
            pos_edges = np.sum(data_arr > 0)
            neg_edges = np.sum(data_arr < 0)
            print(f"    Excitatory edges: {pos_edges:,}")
            print(f"    Inhibitory edges: {neg_edges:,}")
        
        # Report visual neuron coverage
        lc4_in = len([b for b in self.lc_bodies if b in body_to_idx and 
                      self.annotations[self.annotations["bodyId"]==b]["type"].iloc[0] == "LC4"])
        lc4_total = len(self.annotations[self.annotations["type"] == "LC4"])
        print(f"\n  SPIKE: LC4 (escape loom) coverage: {lc4_in}/{lc4_total}")
        
        self.body_to_idx = body_to_idx
        self.idx_to_body = idx_to_body
        self.adjacency = adjacency
        self.n_neurons = n
        
        return adjacency, body_to_idx, idx_to_body


def load_visual_motor(data_dir: Path) -> VisualMotorGraph:
    """Load MaleCNS with visual_motor subgraph extraction."""
    graph = VisualMotorGraph(data_dir)
    graph.load()
    graph.extract_visual_motor()
    return graph
