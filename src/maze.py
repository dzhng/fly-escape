"""
Maze system for fly herding game.

CRITICAL: All chemotaxis uses PURE GRAPH motor control.
No external turn bias - stimuli inject via the bilateral olfactory pathway.

Includes:
- Walls: Rectangular barriers the fly cannot pass
- Sensory objects: Fruit (attractive), vinegar (repellent), light, wind
- Jar/trap: Goal zone with physical entrance
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any
from enum import Enum


class StimulusType(Enum):
    """Types of sensory stimuli."""
    FRUIT = "fruit"           # ✅ Attractive + LANDABLE (pure graph chemotaxis via excitatory LH)
    CRUMB = "crumb"           # ✅ Attractive but NOT landable (trail breadcrumb for navigation)
    VINEGAR = "vinegar"       # ✅ Repellent (pure graph aversion via inhibitory LH)
    LIGHT = "light"           # ✅ AOTU scototaxis (pure graph via geometric → AOTU)
    SHADOW = "shadow"         # ✅ AOTU scototaxis (pure graph via geometric → AOTU)
    WIND = "wind"             # ✅ Physical push + odor advection (environmental, not neural)
    JAR_BAIT = "jar_bait"     # ✅ Weak attractant inside jar (same pathway as fruit)
    THREAT = "threat"         # ✅ Escape trigger via LC4→DNp04 (pure graph escape)
    EXIT = "exit"             # ✅ NEAR-FIELD magnet: attractive odor when close (not house-wide)
    ZAPPER = "zapper"         # ☠️ LETHAL HAZARD: Contact kills fly (UV/blue glow, environment-placed)


# Odor blends for different stimulus types
# These feed into the bilateral olfactory injection (pure graph chemotaxis)
STIMULUS_ODOR_BLENDS = {
    StimulusType.FRUIT: {
        "ethyl_acetate": 1.0,
        "ethyl_butyrate": 0.8,
        "isoamyl_acetate": 0.6,
    },
    # CRUMB: Same odor as fruit but NOT landable (trail breadcrumb)
    StimulusType.CRUMB: {
        "ethyl_acetate": 0.8,   # Slightly weaker than real fruit
        "ethyl_butyrate": 0.6,
        "isoamyl_acetate": 0.4,
    },
    StimulusType.VINEGAR: {
        "acetic_acid": 1.0,  # Maps to aversive glomeruli
    },
    StimulusType.JAR_BAIT: {
        "ethyl_acetate": 0.5,
        "ethyl_butyrate": 0.4,
    },
    # EXIT: Near-field attractive odor ("smell of freedom")
    # Uses SMALL sigma (50-80) so only attracts when fly is in final room
    StimulusType.EXIT: {
        "ethyl_acetate": 1.2,   # Strong fruit-like (outdoor smell)
        "ethyl_butyrate": 0.8,
        "isoamyl_acetate": 0.5,
    },
}


@dataclass
class Wall:
    """A rectangular wall barrier."""
    x: float  # Left edge
    y: float  # Bottom edge
    width: float
    height: float
    
    @property
    def right(self) -> float:
        return self.x + self.width
    
    @property
    def top(self) -> float:
        return self.y + self.height
    
    @property
    def center(self) -> Tuple[float, float]:
        return (self.x + self.width / 2, self.y + self.height / 2)
    
    def contains(self, px: float, py: float, margin: float = 0) -> bool:
        """Check if point is inside wall (with optional margin)."""
        return (self.x - margin <= px <= self.right + margin and 
                self.y - margin <= py <= self.top + margin)
    
    def intersects_segment(
        self, x1: float, y1: float, x2: float, y2: float
    ) -> Tuple[bool, float, float, Optional[str]]:
        """
        Check if line segment intersects wall.
        Returns (intersects, collision_x, collision_y, edge_hit).
        """
        if not self.contains(x2, y2):
            return False, x2, y2, None
        
        dx = x2 - x1
        dy = y2 - y1
        
        t_values = []
        edges = []
        
        if dx != 0:
            t_left = (self.x - x1) / dx
            t_right = (self.right - x1) / dx
            if 0 < t_left < 1:
                y_at_t = y1 + t_left * dy
                if self.y <= y_at_t <= self.top:
                    t_values.append(t_left)
                    edges.append("left")
            if 0 < t_right < 1:
                y_at_t = y1 + t_right * dy
                if self.y <= y_at_t <= self.top:
                    t_values.append(t_right)
                    edges.append("right")
        
        if dy != 0:
            t_bottom = (self.y - y1) / dy
            t_top = (self.top - y1) / dy
            if 0 < t_bottom < 1:
                x_at_t = x1 + t_bottom * dx
                if self.x <= x_at_t <= self.right:
                    t_values.append(t_bottom)
                    edges.append("bottom")
            if 0 < t_top < 1:
                x_at_t = x1 + t_top * dx
                if self.x <= x_at_t <= self.right:
                    t_values.append(t_top)
                    edges.append("top")
        
        if t_values:
            idx = np.argmin(t_values)
            t = t_values[idx]
            edge = edges[idx]
            return True, x1 + t * dx * 0.95, y1 + t * dy * 0.95, edge
        
        return True, x1, y1, None


@dataclass
class Stimulus:
    """
    A sensory stimulus object.
    
    CRITICAL: Effects are applied via bilateral olfactory injection,
    NOT external turn bias. The 'attraction' field feeds concentration
    to the olfactory system which then drives motor output through the graph.
    
    WIND ADVECTION: Odor-emitting stimuli (FRUIT, VINEGAR, JAR_BAIT) can have
    their concentration fields transported by wind. This is environmental smell
    transport, NOT a neural turn cheat. The fly still detects odor via bilateral
    antennae → pure-graph chemotaxis.
    """
    type: StimulusType
    x: float
    y: float
    intensity: float = 1.0
    sigma: float = 50.0
    direction: float = 0.0  # For wind: direction in radians
    
    def concentration(self, px: float, py: float) -> float:
        """Get odor/stimulus concentration at position (Gaussian, no advection)."""
        d2 = (px - self.x) ** 2 + (py - self.y) ** 2
        return self.intensity * np.exp(-d2 / (2 * self.sigma ** 2))
    
    def advected_concentration(
        self,
        px: float,
        py: float,
        wind_vx: float,
        wind_vy: float,
        advection_strength: float = 0.5,
    ) -> float:
        """
        Get odor concentration with wind advection.
        
        Wind stretches the odor plume downwind. The model:
        1. Effective source is shifted UPWIND (odor carried from there)
        2. Sigma stretches in wind direction (plume elongates)
        3. This is ENVIRONMENTAL transport, not a neural bias
        
        Args:
            px, py: Query position
            wind_vx, wind_vy: Wind velocity at this stimulus location
            advection_strength: How much wind affects plume (0=none, 1=strong)
        
        Returns:
            Advected concentration at (px, py)
        """
        if self.type == StimulusType.WIND:
            return 0.0
        
        wind_speed = np.sqrt(wind_vx**2 + wind_vy**2)
        if wind_speed < 0.01:
            return self.concentration(px, py)
        
        wind_dx = wind_vx / wind_speed if wind_speed > 0 else 0
        wind_dy = wind_vy / wind_speed if wind_speed > 0 else 0
        
        shift_amount = wind_speed * advection_strength * self.sigma * 0.5
        effective_x = self.x - wind_dx * shift_amount
        effective_y = self.y - wind_dy * shift_amount
        
        stretch_factor = 1.0 + wind_speed * advection_strength * 2.0
        sigma_parallel = self.sigma * stretch_factor
        sigma_perp = self.sigma
        
        dx = px - effective_x
        dy = py - effective_y
        
        d_parallel = dx * wind_dx + dy * wind_dy
        d_perp = -dx * wind_dy + dy * wind_dx
        
        d2_normalized = (d_parallel / sigma_parallel) ** 2 + (d_perp / sigma_perp) ** 2
        
        return self.intensity * np.exp(-d2_normalized / 2)
    
    def get_physical_effect(self, px: float, py: float) -> Dict[str, float]:
        """
        Get PHYSICAL (non-neural) effects at position.
        Only wind has physical effects - everything else is neural.
        """
        conc = self.concentration(px, py)
        
        if self.type == StimulusType.WIND:
            return {
                "thrust_push": conc * np.cos(self.direction) * 0.3,
                "lateral_push": conc * np.sin(self.direction) * 0.3,
            }
        
        return {"thrust_push": 0.0, "lateral_push": 0.0}
    
    def get_odor_contribution(self, px: float, py: float) -> Tuple[float, Dict[str, float], bool]:
        """
        Get odor contribution for bilateral injection.
        Returns (concentration, odor_blend, is_aversive).
        
        ATTRACTIVE odors (fruit) → excitatory LH pathway → turn toward
        AVERSIVE odors (vinegar) → inhibitory LH pathway → turn away
        
        Both use PURE GRAPH chemotaxis — no external turn bias.
        """
        conc = self.concentration(px, py)
        
        if self.type in [StimulusType.FRUIT, StimulusType.JAR_BAIT]:
            return conc, STIMULUS_ODOR_BLENDS.get(self.type, {}), False
        elif self.type == StimulusType.VINEGAR:
            # PURE GRAPH AVERSION: Inject to inhibitory LH pathway
            # NOT a soft repel / negative concentration hack
            return conc, STIMULUS_ODOR_BLENDS.get(self.type, {}), True
        elif self.type == StimulusType.LIGHT:
            # ⚠️ SOFT STUB: Light uses olfactory pathway as proxy
            # TRUE phototaxis would require R7/R8 → Medulla → LC → DN pathway
            # NOT in motor1hop subgraph; would need ~20-50K more neurons
            # See SPIKE_LEARNINGS.md and BALANCE.md section 4b for details
            return conc * 0.3, STIMULUS_ODOR_BLENDS.get(StimulusType.FRUIT, {}), False
        elif self.type == StimulusType.SHADOW:
            # ⚠️ SOFT STUB: Shadow uses inhibitory LH as proxy for scotophobia
            # TRUE shadow avoidance would require visual pathway
            # See SPIKE_LEARNINGS.md and BALANCE.md section 4b for details
            return conc * 0.2, {}, True
        
        return 0.0, {}, False


@dataclass
class Jar:
    """
    A jar/trap goal zone.
    
    Physical entrance - fly must enter through the opening.
    Optional bait uses the SAME olfactory pathway (no teleport).
    """
    x: float  # Center x
    y: float  # Center y
    radius: float = 30.0
    opening_direction: float = np.pi  # Direction entrance faces (radians)
    opening_width: float = 0.6  # Fraction of circumference that's open
    has_bait: bool = True
    bait_intensity: float = 0.5
    
    def is_inside(self, px: float, py: float) -> bool:
        """Check if point is inside jar."""
        d2 = (px - self.x) ** 2 + (py - self.y) ** 2
        return d2 <= self.radius ** 2
    
    def get_opening_arc(self) -> Tuple[float, float]:
        """Get start and end angles of opening."""
        half_opening = self.opening_width * np.pi
        return (
            self.opening_direction - half_opening,
            self.opening_direction + half_opening,
        )
    
    def is_in_opening(self, px: float, py: float) -> bool:
        """Check if point is in the opening arc."""
        angle = np.arctan2(py - self.y, px - self.x)
        start, end = self.get_opening_arc()
        
        # Normalize angles
        angle = (angle + 2 * np.pi) % (2 * np.pi)
        start = (start + 2 * np.pi) % (2 * np.pi)
        end = (end + 2 * np.pi) % (2 * np.pi)
        
        if start < end:
            return start <= angle <= end
        else:  # Wraps around 0
            return angle >= start or angle <= end
    
    def entered_through_opening(
        self, old_x: float, old_y: float, new_x: float, new_y: float
    ) -> bool:
        """Check if fly entered jar through the opening (valid win)."""
        was_outside = not self.is_inside(old_x, old_y)
        is_inside = self.is_inside(new_x, new_y)
        
        if not (was_outside and is_inside):
            return False
        
        # Check entry point is in opening
        # Entry point is approximately at the radius
        entry_angle = np.arctan2(new_y - self.y, new_x - self.x)
        start, end = self.get_opening_arc()
        
        # Normalize
        entry_angle = (entry_angle + 2 * np.pi) % (2 * np.pi)
        start = (start + 2 * np.pi) % (2 * np.pi)
        end = (end + 2 * np.pi) % (2 * np.pi)
        
        if start < end:
            return start <= entry_angle <= end
        else:
            return entry_angle >= start or entry_angle <= end
    
    def blocks_movement(
        self, old_x: float, old_y: float, new_x: float, new_y: float
    ) -> Tuple[bool, float, float]:
        """
        Check if jar wall blocks movement.
        Returns (blocked, final_x, final_y).
        """
        was_outside = not self.is_inside(old_x, old_y)
        will_be_inside = self.is_inside(new_x, new_y)
        
        if was_outside and will_be_inside:
            if not self.entered_through_opening(old_x, old_y, new_x, new_y):
                # Blocked by jar wall - push back to edge
                dx = new_x - self.x
                dy = new_y - self.y
                d = np.sqrt(dx ** 2 + dy ** 2)
                if d > 0:
                    new_x = self.x + dx / d * (self.radius + 2)
                    new_y = self.y + dy / d * (self.radius + 2)
                return True, new_x, new_y
        
        return False, new_x, new_y
    
    def get_opening_position(self) -> Tuple[float, float]:
        """Get center of jar opening."""
        return (
            self.x + self.radius * np.cos(self.opening_direction),
            self.y + self.radius * np.sin(self.opening_direction),
        )


@dataclass
class Maze:
    """
    A maze level with walls, stimuli, and jar.
    
    CRITICAL: All chemotaxis uses pure-graph motor control.
    Stimuli provide concentration fields that feed into bilateral
    olfactory injection - no external turn bias.
    """
    width: float = 500.0
    height: float = 400.0
    walls: List[Wall] = field(default_factory=list)
    stimuli: List[Stimulus] = field(default_factory=list)
    jar: Optional[Jar] = None
    
    fly_start_x: float = 50.0
    fly_start_y: float = 200.0
    fly_start_theta: float = 0.0
    
    name: str = "Untitled Level"
    time_limit: int = 3000  # Steps before timeout
    
    def add_wall(self, x: float, y: float, width: float, height: float):
        """Add a wall to the maze."""
        self.walls.append(Wall(x, y, width, height))
    
    def add_stimulus(
        self,
        stim_type: StimulusType,
        x: float,
        y: float,
        intensity: float = 1.0,
        sigma: float = 50.0,
        direction: float = 0.0,
    ):
        """Add a stimulus to the maze."""
        self.stimuli.append(Stimulus(stim_type, x, y, intensity, sigma, direction))
    
    def set_jar(
        self,
        x: float,
        y: float,
        radius: float = 35.0,
        opening_direction: float = np.pi,
        opening_width: float = 0.6,
        has_bait: bool = True,
        bait_intensity: float = 0.5,
    ):
        """Set the jar/trap position."""
        self.jar = Jar(
            x, y, radius, opening_direction, opening_width, has_bait, bait_intensity
        )
        
        if has_bait:
            self.stimuli.append(Stimulus(
                StimulusType.JAR_BAIT,
                x, y,
                intensity=bait_intensity,
                sigma=radius * 1.5,
            ))
    
    def check_wall_collision(
        self,
        old_x: float,
        old_y: float,
        new_x: float,
        new_y: float,
    ) -> Tuple[float, float, Optional[str]]:
        """
        Check wall collisions and return valid position.
        Returns (final_x, final_y, edge_hit or None).
        """
        final_x, final_y = new_x, new_y
        edge_hit = None
        
        for wall in self.walls:
            collided, cx, cy, edge = wall.intersects_segment(
                old_x, old_y, final_x, final_y
            )
            if collided:
                final_x, final_y = cx, cy
                edge_hit = edge
        
        return final_x, final_y, edge_hit
    
    def check_jar_collision(
        self,
        old_x: float,
        old_y: float,
        new_x: float,
        new_y: float,
    ) -> Tuple[float, float, bool]:
        """
        Check jar collision.
        Returns (final_x, final_y, blocked).
        """
        if self.jar is None:
            return new_x, new_y, False
        
        blocked, final_x, final_y = self.jar.blocks_movement(
            old_x, old_y, new_x, new_y
        )
        return final_x, final_y, blocked
    
    def check_boundary(
        self,
        x: float,
        y: float,
        border: float = 5.0,
    ) -> Tuple[float, float, bool]:
        """
        Check arena boundary and clamp position.
        Returns (final_x, final_y, hit_boundary).
        """
        hit = False
        
        if x < border:
            x = border
            hit = True
        elif x > self.width - border:
            x = self.width - border
            hit = True
        
        if y < border:
            y = border
            hit = True
        elif y > self.height - border:
            y = self.height - border
            hit = True
        
        return x, y, hit
    
    def get_wind_at(self, x: float, y: float) -> Tuple[float, float]:
        """
        Get total wind velocity at position.
        
        Returns:
            (wind_vx, wind_vy) - wind velocity components
        """
        wind_vx = 0.0
        wind_vy = 0.0
        
        for stim in self.stimuli:
            if stim.type == StimulusType.WIND:
                conc = stim.concentration(x, y)
                wind_vx += conc * stim.intensity * np.cos(stim.direction)
                wind_vy += conc * stim.intensity * np.sin(stim.direction)
        
        return wind_vx, wind_vy
    
    def get_total_odor_at(
        self,
        x: float,
        y: float,
        use_advection: bool = True,
        advection_strength: float = 0.5,
    ) -> Tuple[float, Dict[str, float], float, Dict[str, float]]:
        """
        Get total odor concentration and blend at position (attractive + aversive).
        This feeds into bilateral olfactory injection.
        
        WIND ADVECTION: When use_advection=True, wind stretches odor plumes
        downwind. This is environmental smell transport, NOT a neural turn bias.
        The fly still detects odor via bilateral antennae → pure-graph chemotaxis.
        
        ATTRACTIVE vs AVERSIVE:
        - Attractive (fruit, jar_bait): inject to excitatory LH → turn toward
        - Aversive (vinegar): inject to inhibitory LH → turn away
        
        Args:
            x, y: Query position
            use_advection: Whether to apply wind advection to odor fields
            advection_strength: How much wind affects plumes (0=none, 1=strong)
        
        Returns:
            (attractive_conc, attractive_blend, aversive_conc, aversive_blend)
        """
        attractive_conc = 0.0
        attractive_blend = {}
        aversive_conc = 0.0
        aversive_blend = {}
        
        wind_vx, wind_vy = self.get_wind_at(x, y) if use_advection else (0.0, 0.0)
        
        for stim in self.stimuli:
            if stim.type == StimulusType.WIND:
                continue
            
            # Get base concentration (with advection if enabled)
            if use_advection and (wind_vx != 0 or wind_vy != 0):
                wind_at_stim_vx, wind_at_stim_vy = self.get_wind_at(stim.x, stim.y)
                base_conc = stim.advected_concentration(
                    x, y, wind_at_stim_vx, wind_at_stim_vy, advection_strength
                )
            else:
                base_conc = stim.concentration(x, y)
            
            conc, blend, is_aversive = stim.get_odor_contribution(x, y)
            
            # Apply advection scaling
            if base_conc > 0 and conc > 0:
                scale = base_conc / max(0.001, stim.concentration(x, y))
                conc = conc * scale
            
            if conc > 0:
                if is_aversive:
                    aversive_conc += conc
                    for odorant, amount in blend.items():
                        aversive_blend[odorant] = aversive_blend.get(odorant, 0) + amount * conc
                else:
                    attractive_conc += conc
                    for odorant, amount in blend.items():
                        attractive_blend[odorant] = attractive_blend.get(odorant, 0) + amount * conc
        
        # Normalize blends
        if attractive_conc > 0:
            for k in attractive_blend:
                attractive_blend[k] /= attractive_conc
        if aversive_conc > 0:
            for k in aversive_blend:
                aversive_blend[k] /= aversive_conc
        
        return attractive_conc, attractive_blend, aversive_conc, aversive_blend
    
    def get_physical_effects_at(self, x: float, y: float) -> Dict[str, float]:
        """Get total physical (non-neural) effects at position."""
        total = {"thrust_push": 0.0, "lateral_push": 0.0}
        
        for stim in self.stimuli:
            effect = stim.get_physical_effect(x, y)
            for k, v in effect.items():
                total[k] += v
        
        return total
    
    def check_win(
        self, old_x: float, old_y: float, new_x: float, new_y: float
    ) -> bool:
        """Check if fly has won (entered jar through opening)."""
        if self.jar is None:
            return False
        return self.jar.entered_through_opening(old_x, old_y, new_x, new_y)
    
    def is_fly_in_jar(self, x: float, y: float) -> bool:
        """Check if fly is inside jar."""
        if self.jar is None:
            return False
        return self.jar.is_inside(x, y)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert maze to JSON-serializable dict."""
        return {
            "name": self.name,
            "width": self.width,
            "height": self.height,
            "time_limit": self.time_limit,
            "fly_start": {
                "x": self.fly_start_x,
                "y": self.fly_start_y,
                "theta": self.fly_start_theta,
            },
            "walls": [
                {"x": w.x, "y": w.y, "width": w.width, "height": w.height}
                for w in self.walls
            ],
            "stimuli": [
                {
                    "type": s.type.value,
                    "x": s.x,
                    "y": s.y,
                    "intensity": s.intensity,
                    "sigma": s.sigma,
                    "direction": s.direction,
                }
                for s in self.stimuli if s.type != StimulusType.JAR_BAIT
            ],
            "jar": {
                "x": self.jar.x,
                "y": self.jar.y,
                "radius": self.jar.radius,
                "opening_direction": self.jar.opening_direction,
                "opening_width": self.jar.opening_width,
                "has_bait": self.jar.has_bait,
                "bait_intensity": self.jar.bait_intensity,
            } if self.jar else None,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Maze":
        """Load maze from dict."""
        maze = cls(
            width=data.get("width", 500),
            height=data.get("height", 400),
            name=data.get("name", "Loaded Level"),
            time_limit=data.get("time_limit", 3000),
        )
        
        start = data.get("fly_start", {})
        maze.fly_start_x = start.get("x", 50)
        maze.fly_start_y = start.get("y", 200)
        maze.fly_start_theta = start.get("theta", 0)
        
        for w in data.get("walls", []):
            maze.add_wall(w["x"], w["y"], w["width"], w["height"])
        
        for s in data.get("stimuli", []):
            maze.add_stimulus(
                StimulusType(s["type"]),
                s["x"],
                s["y"],
                s.get("intensity", 1.0),
                s.get("sigma", 50.0),
                s.get("direction", 0.0),
            )
        
        jar_data = data.get("jar")
        if jar_data:
            maze.set_jar(
                jar_data["x"],
                jar_data["y"],
                jar_data.get("radius", 35),
                jar_data.get("opening_direction", np.pi),
                jar_data.get("opening_width", 0.6),
                jar_data.get("has_bait", True),
                jar_data.get("bait_intensity", 0.5),
            )
        
        return maze


def create_herding_level() -> Maze:
    """
    Create a level designed to demonstrate successful herding.
    
    Layout:
    - Fly starts on left
    - Corridor with fruit trail leading to jar on right
    - Walls force the fly through the corridor
    - Jar at the end with bait
    """
    maze = Maze(
        width=600,
        height=300,
        name="Fruit Trail Herding",
        time_limit=2000,
    )
    
    # Fly starts on left side
    maze.fly_start_x = 50
    maze.fly_start_y = 150
    maze.fly_start_theta = 0  # Facing right
    
    # Top wall with gap
    maze.add_wall(0, 250, 200, 50)     # Top-left wall
    maze.add_wall(250, 250, 350, 50)   # Top-right wall
    
    # Bottom wall with gap  
    maze.add_wall(0, 0, 200, 50)       # Bottom-left wall
    maze.add_wall(250, 0, 350, 50)     # Bottom-right wall
    
    # Fruit trail leading to jar (pure graph attraction)
    maze.add_stimulus(StimulusType.FRUIT, 120, 150, intensity=0.8, sigma=60)
    maze.add_stimulus(StimulusType.FRUIT, 220, 150, intensity=0.9, sigma=50)
    maze.add_stimulus(StimulusType.FRUIT, 320, 150, intensity=1.0, sigma=50)
    maze.add_stimulus(StimulusType.FRUIT, 420, 150, intensity=1.2, sigma=60)
    
    # Jar at the end with opening facing left (toward the fly)
    maze.set_jar(
        x=530,
        y=150,
        radius=40,
        opening_direction=np.pi,  # Opening faces left
        opening_width=0.7,        # Wide opening
        has_bait=True,
        bait_intensity=0.8,       # Strong bait
    )
    
    return maze


def create_obstacle_level() -> Maze:
    """
    Create a level with obstacles requiring navigation.
    
    Layout:
    - S-curve corridor with walls
    - Multiple fruit waypoints
    - Vinegar to discourage wrong paths
    """
    maze = Maze(
        width=600,
        height=400,
        name="Obstacle Course",
        time_limit=2500,
    )
    
    maze.fly_start_x = 50
    maze.fly_start_y = 200
    maze.fly_start_theta = 0
    
    # First vertical barrier with bottom gap
    maze.add_wall(150, 150, 20, 250)
    
    # Second vertical barrier with top gap
    maze.add_wall(300, 0, 20, 250)
    
    # Third vertical barrier with bottom gap
    maze.add_wall(450, 150, 20, 250)
    
    # Fruit trail through the gaps
    maze.add_stimulus(StimulusType.FRUIT, 100, 200, intensity=0.7, sigma=50)
    maze.add_stimulus(StimulusType.FRUIT, 150, 80, intensity=0.8, sigma=40)
    maze.add_stimulus(StimulusType.FRUIT, 230, 100, intensity=0.9, sigma=50)
    maze.add_stimulus(StimulusType.FRUIT, 310, 320, intensity=0.9, sigma=50)
    maze.add_stimulus(StimulusType.FRUIT, 400, 300, intensity=1.0, sigma=50)
    maze.add_stimulus(StimulusType.FRUIT, 450, 80, intensity=1.0, sigma=40)
    
    # Vinegar to discourage wrong paths
    maze.add_stimulus(StimulusType.VINEGAR, 150, 300, intensity=0.6, sigma=40)
    maze.add_stimulus(StimulusType.VINEGAR, 300, 80, intensity=0.6, sigma=40)
    
    # Jar at the end
    maze.set_jar(
        x=550,
        y=100,
        radius=40,
        opening_direction=np.pi,
        opening_width=0.6,
        has_bait=True,
        bait_intensity=0.7,
    )
    
    return maze
