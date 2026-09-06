"""
2D Arena simulation with unicycle kinematics and odor gradients.

The fly moves in a sterile glass arena using unicycle dynamics:
- Position (x, y) and heading theta
- Thrust controls forward velocity
- Turn controls angular velocity

Odor sources create Gaussian concentration gradients.
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


@dataclass
class OdorSource:
    """A point odor source with Gaussian diffusion."""
    x: float
    y: float
    intensity: float = 1.0
    sigma: float = 50.0
    name: str = "fruit"
    
    def concentration(self, x: float, y: float) -> float:
        """Get odor concentration at position (x, y)."""
        d2 = (x - self.x) ** 2 + (y - self.y) ** 2
        return self.intensity * np.exp(-d2 / (2 * self.sigma ** 2))
    
    def gradient(self, x: float, y: float) -> Tuple[float, float]:
        """Get odor gradient (dC/dx, dC/dy) at position (x, y)."""
        c = self.concentration(x, y)
        dx = -(x - self.x) / (self.sigma ** 2) * c
        dy = -(y - self.y) / (self.sigma ** 2) * c
        return dx, dy


@dataclass
class ArenaConfig:
    """Arena configuration."""
    width: float = 300.0
    height: float = 300.0
    border: float = 10.0
    
    fly_start_x: float = 150.0
    fly_start_y: float = 150.0
    fly_start_theta: float = 0.0
    
    max_speed: float = 1.5
    max_angular_speed: float = 0.15
    thrust_scale: float = 1.0
    turn_scale: float = 0.12
    
    dt: float = 1.0


@dataclass
class Arena:
    """2D arena with fly and odor sources."""
    
    config: ArenaConfig = field(default_factory=ArenaConfig)
    odor_sources: List[OdorSource] = field(default_factory=list)
    
    x: float = field(init=False)
    y: float = field(init=False)
    theta: float = field(init=False)
    
    path_x: List[float] = field(default_factory=list)
    path_y: List[float] = field(default_factory=list)
    path_theta: List[float] = field(default_factory=list)
    
    def __post_init__(self):
        self.reset()
    
    def reset(self):
        """Reset fly to starting position."""
        self.x = self.config.fly_start_x
        self.y = self.config.fly_start_y
        self.theta = self.config.fly_start_theta
        self.path_x = [self.x]
        self.path_y = [self.y]
        self.path_theta = [self.theta]
    
    def add_odor_source(self, source: OdorSource):
        """Add an odor source to the arena."""
        self.odor_sources.append(source)
    
    def get_total_odor(self, x: Optional[float] = None, y: Optional[float] = None) -> float:
        """Get total odor concentration at position."""
        if x is None:
            x = self.x
        if y is None:
            y = self.y
        return sum(s.concentration(x, y) for s in self.odor_sources)
    
    def get_odor_gradient(self, x: Optional[float] = None, y: Optional[float] = None) -> Tuple[float, float]:
        """Get total odor gradient at position."""
        if x is None:
            x = self.x
        if y is None:
            y = self.y
        gx, gy = 0.0, 0.0
        for s in self.odor_sources:
            dx, dy = s.gradient(x, y)
            gx += dx
            gy += dy
        return gx, gy
    
    def get_odor_in_heading(self) -> float:
        """Get odor gradient projected onto fly's heading direction."""
        gx, gy = self.get_odor_gradient()
        heading_x = np.cos(self.theta)
        heading_y = np.sin(self.theta)
        return gx * heading_x + gy * heading_y
    
    def get_odor_perpendicular(self) -> float:
        """Get odor gradient perpendicular to heading (+ = odor on right)."""
        gx, gy = self.get_odor_gradient()
        perp_x = -np.sin(self.theta)
        perp_y = np.cos(self.theta)
        return gx * perp_x + gy * perp_y
    
    def step(self, thrust: float, turn: float):
        """
        Update fly position using unicycle kinematics.
        
        Args:
            thrust: Forward velocity command (scaled internally)
            turn: Angular velocity command (scaled internally)
        """
        cfg = self.config
        
        speed = np.clip(thrust * cfg.thrust_scale, -cfg.max_speed, cfg.max_speed)
        omega = np.clip(turn * cfg.turn_scale, -cfg.max_angular_speed, cfg.max_angular_speed)
        
        self.theta += omega * cfg.dt
        self.theta = (self.theta + np.pi) % (2 * np.pi) - np.pi
        
        dx = speed * np.cos(self.theta) * cfg.dt
        dy = speed * np.sin(self.theta) * cfg.dt
        
        new_x = self.x + dx
        new_y = self.y + dy
        
        border = cfg.border
        if new_x < border:
            new_x = border
            self.theta = np.pi - self.theta + np.random.uniform(-0.2, 0.2)
        elif new_x > cfg.width - border:
            new_x = cfg.width - border
            self.theta = np.pi - self.theta + np.random.uniform(-0.2, 0.2)
        
        if new_y < border:
            new_y = border
            self.theta = -self.theta + np.random.uniform(-0.2, 0.2)
        elif new_y > cfg.height - border:
            new_y = cfg.height - border
            self.theta = -self.theta + np.random.uniform(-0.2, 0.2)
        
        self.theta = (self.theta + np.pi) % (2 * np.pi) - np.pi
        
        self.x = new_x
        self.y = new_y
        
        self.path_x.append(self.x)
        self.path_y.append(self.y)
        self.path_theta.append(self.theta)
    
    def distance_to_source(self, source_idx: int = 0) -> float:
        """Get distance from fly to specified odor source."""
        if source_idx >= len(self.odor_sources):
            return float('inf')
        s = self.odor_sources[source_idx]
        return np.sqrt((self.x - s.x) ** 2 + (self.y - s.y) ** 2)
    
    def get_path_array(self) -> np.ndarray:
        """Get path as Nx3 array (x, y, theta)."""
        return np.column_stack([self.path_x, self.path_y, self.path_theta])
    
    def compute_metrics(self, source_idx: int = 0) -> dict:
        """Compute chemotaxis metrics for path."""
        if source_idx >= len(self.odor_sources):
            return {}
        
        s = self.odor_sources[source_idx]
        path = self.get_path_array()
        
        distances = np.sqrt((path[:, 0] - s.x) ** 2 + (path[:, 1] - s.y) ** 2)
        
        to_source_x = s.x - path[:, 0]
        to_source_y = s.y - path[:, 1]
        to_source_norm = np.sqrt(to_source_x ** 2 + to_source_y ** 2)
        to_source_x /= (to_source_norm + 1e-8)
        to_source_y /= (to_source_norm + 1e-8)
        
        heading_x = np.cos(path[:, 2])
        heading_y = np.sin(path[:, 2])
        
        heading_alignment = heading_x * to_source_x + heading_y * to_source_y
        
        return {
            "mean_distance": float(np.mean(distances)),
            "final_distance": float(distances[-1]),
            "min_distance": float(np.min(distances)),
            "mean_heading_alignment": float(np.mean(heading_alignment)),
            "path_length": float(np.sum(np.sqrt(np.diff(path[:, 0]) ** 2 + np.diff(path[:, 1]) ** 2))),
        }
