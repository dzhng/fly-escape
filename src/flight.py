"""
Flight dynamics for Drosophila simulation.

DUAL KINEMATICS: Walking vs Flying
- WALKING: Slow, precise, direct control (ground locomotion)
- FLYING: Fast, momentum-based, overshoot (aerial locomotion)

Flight motor readout uses flight-related DNs:
- DNa01, DNa02: Steering/turning
- DNg13, DNg14: Wing power
- DNp09, DNb01, DNb02: Flight initiation/power

TAKEOFF GATES (pure-graph preferred):
- Hunger high → inject flight-initiation DNs (DNb01, DNb02)
- Threat escape loom (LC4→DNp04) → takeoff via Giant Fiber
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Set, Dict
from enum import Enum


class LocomotionMode(Enum):
    """Current locomotion mode."""
    WALKING = "walking"    # Ground locomotion - slow, precise
    FLYING = "flying"      # Aerial locomotion - fast, momentum


# Known flight-related DN types from Drosophila literature
FLIGHT_DN_TYPES = [
    "DNa01",  # Steering - L/R turn
    "DNa02",  # Steering
    "DNg13",  # Wing power/steering
    "DNg14",  # Wing power/steering
    "DNp09",  # Flight power
    "DNb01",  # Flight initiation
    "DNb02",  # Flight power
    "DNp03",  # Flight related
]

# Flight INITIATION DNs - trigger takeoff when activated
# SPIKE: DNb01/DNb02 are known flight initiation neurons (Namiki et al.)
TAKEOFF_DN_LEFT = [10654, 12767, 529488, 11074, 524225]  # DNb01_L, DNb02_L, DNg13_L, DNg14_L
TAKEOFF_DN_RIGHT = [10759, 10805, 13922, 512006, 12224]  # DNb01_R, DNb02_R, DNg13_R, DNg14_R


@dataclass
class WalkParams:
    """Walking dynamics parameters - slow, precise ground locomotion."""
    max_speed: float = 1.2           # Much slower than flight
    max_angular_speed: float = 0.15  # Tighter turns when walking
    
    drag: float = 0.15               # Higher drag (more friction on ground)
    angular_drag: float = 0.2        # Higher angular drag
    
    thrust_gain: float = 0.08        # Lower thrust response
    turn_gain: float = 0.06          # Tighter turn control
    
    dt: float = 1.0
    min_speed: float = 0.0           # Can stop completely when walking


@dataclass
class FlightParams:
    """Flight dynamics parameters - fast, momentum-based aerial locomotion."""
    # Speed limits
    max_speed: float = 4.0           # Much faster than walking
    max_angular_speed: float = 0.25  # Fast turning in flight
    
    # Momentum/drag
    drag: float = 0.03               # Low drag (air resistance only)
    angular_drag: float = 0.1        # Angular velocity decay
    
    # Control gains
    thrust_gain: float = 0.15        # How much DN activity affects acceleration
    turn_gain: float = 0.08          # How much L/R asymmetry affects yaw rate
    
    # Physics
    dt: float = 1.0                  # Time step
    min_speed: float = 0.5           # Minimum forward speed when flying (stall speed)


@dataclass
class FlightState:
    """State of the fly (walking or flying)."""
    x: float = 0.0
    y: float = 0.0
    theta: float = 0.0       # Heading angle
    
    vx: float = 0.0          # Velocity x component
    vy: float = 0.0          # Velocity y component
    omega: float = 0.0       # Angular velocity
    
    @property
    def speed(self) -> float:
        return np.sqrt(self.vx ** 2 + self.vy ** 2)
    
    @property
    def velocity_heading(self) -> float:
        """Direction of velocity vector."""
        return np.arctan2(self.vy, self.vx)


class FlightDynamics:
    """
    Dual-mode locomotion dynamics: WALKING vs FLYING.
    
    WALKING (ground):
    - Slow max speed (1.2 vs 4.0)
    - High friction/drag (precise control)
    - Can stop completely
    - Good for landing/feeding/navigation near obstacles
    
    FLYING (aerial):
    - Fast max speed (4.0)
    - Low drag (momentum-based, overshoot)
    - Minimum stall speed
    - Good for covering distance, escaping threats
    
    Mode transitions:
    - TAKEOFF: WALKING → FLYING (hunger or threat trigger)
    - LANDING: FLYING → WALKING (loom signal near fruit)
    """
    
    def __init__(
        self,
        flight_params: Optional[FlightParams] = None,
        walk_params: Optional[WalkParams] = None,
        initial_mode: LocomotionMode = LocomotionMode.WALKING,
    ):
        self.flight_params = flight_params or FlightParams()
        self.walk_params = walk_params or WalkParams()
        self.mode = initial_mode
        self.state = FlightState()
        
        # Path history
        self.path_x: List[float] = []
        self.path_y: List[float] = []
        self.path_theta: List[float] = []
        self.path_modes: List[str] = []  # Track mode at each step
        
        # Mode transition counters
        self.takeoff_count = 0
        self.landing_count = 0
    
    @property
    def params(self) -> FlightParams:
        """Get current mode's parameters (for compatibility)."""
        if self.mode == LocomotionMode.FLYING:
            return self.flight_params
        else:
            # Return walk params as if they were flight params
            # (duck typing - same interface)
            return self.walk_params
    
    @property
    def is_flying(self) -> bool:
        return self.mode == LocomotionMode.FLYING
    
    @property
    def is_walking(self) -> bool:
        return self.mode == LocomotionMode.WALKING
    
    def takeoff(self):
        """Transition from WALKING to FLYING."""
        if self.mode == LocomotionMode.WALKING:
            self.mode = LocomotionMode.FLYING
            self.takeoff_count += 1
            # Give initial flight speed boost
            if self.state.speed < self.flight_params.min_speed:
                self.state.vx = self.flight_params.min_speed * np.cos(self.state.theta)
                self.state.vy = self.flight_params.min_speed * np.sin(self.state.theta)
    
    def land(self):
        """Transition from FLYING to WALKING."""
        if self.mode == LocomotionMode.FLYING:
            self.mode = LocomotionMode.WALKING
            self.landing_count += 1
            # Reduce speed for landing
            self.state.vx *= 0.3
            self.state.vy *= 0.3
    
    def reset(
        self,
        x: float,
        y: float,
        theta: float,
        initial_speed: float = 0.5,
        initial_mode: LocomotionMode = LocomotionMode.WALKING,
    ):
        """Reset to initial position with optional initial velocity and mode."""
        self.mode = initial_mode
        self.state = FlightState(
            x=x, y=y, theta=theta,
            vx=initial_speed * np.cos(theta),
            vy=initial_speed * np.sin(theta),
            omega=0.0,
        )
        self.path_x = [x]
        self.path_y = [y]
        self.path_theta = [theta]
        self.path_modes = [self.mode.value]
        self.takeoff_count = 0
        self.landing_count = 0
    
    def step(self, thrust: float, turn: float) -> Tuple[float, float]:
        """
        Apply thrust and turn commands, update state.
        
        Uses current locomotion mode's parameters:
        - WALKING: slow, high drag, precise control
        - FLYING: fast, low drag, momentum-based
        
        Args:
            thrust: Forward thrust command (from DN activity)
            turn: Turn command (from L/R DN asymmetry)
        
        Returns:
            (new_x, new_y) position
        """
        # Get current mode parameters
        if self.mode == LocomotionMode.FLYING:
            p = self.flight_params
        else:
            p = self.walk_params
        
        s = self.state
        
        # Apply angular acceleration from turn command
        angular_accel = turn * p.turn_gain
        s.omega += angular_accel
        s.omega *= (1 - p.angular_drag)  # Angular drag
        s.omega = np.clip(s.omega, -p.max_angular_speed, p.max_angular_speed)
        
        # Update heading
        s.theta += s.omega * p.dt
        s.theta = (s.theta + np.pi) % (2 * np.pi) - np.pi
        
        # Apply thrust in heading direction
        accel = thrust * p.thrust_gain
        ax = accel * np.cos(s.theta)
        ay = accel * np.sin(s.theta)
        
        # Update velocity with acceleration
        s.vx += ax * p.dt
        s.vy += ay * p.dt
        
        # Apply drag
        s.vx *= (1 - p.drag)
        s.vy *= (1 - p.drag)
        
        # Enforce speed limits
        speed = s.speed
        if speed > p.max_speed:
            scale = p.max_speed / speed
            s.vx *= scale
            s.vy *= scale
        elif speed < p.min_speed and thrust > 0:
            # Maintain minimum speed when thrusting (stall prevention for flight)
            if speed > 0.01:
                scale = p.min_speed / speed
                s.vx *= scale
                s.vy *= scale
            else:
                s.vx = p.min_speed * np.cos(s.theta)
                s.vy = p.min_speed * np.sin(s.theta)
        
        # Update position
        s.x += s.vx * p.dt
        s.y += s.vy * p.dt
        
        # Record path
        self.path_x.append(s.x)
        self.path_y.append(s.y)
        self.path_theta.append(s.theta)
        self.path_modes.append(self.mode.value)
        
        return s.x, s.y
    
    def apply_collision(
        self,
        new_x: float,
        new_y: float,
        normal_angle: Optional[float] = None,
    ):
        """
        Handle collision by updating position and reflecting velocity.
        
        Args:
            new_x, new_y: Corrected position after collision
            normal_angle: Angle of surface normal (for reflection)
        """
        s = self.state
        
        # Update position
        s.x = new_x
        s.y = new_y
        
        # Reflect velocity if normal provided
        if normal_angle is not None:
            # Reflect velocity vector
            v_mag = s.speed
            v_angle = s.velocity_heading
            
            # Reflection: v' = v - 2(v·n)n
            # In angle terms: reflected = 2*normal - incident
            reflected_angle = 2 * normal_angle - v_angle + np.pi
            
            # Lose some speed on collision
            v_mag *= 0.6
            
            s.vx = v_mag * np.cos(reflected_angle)
            s.vy = v_mag * np.sin(reflected_angle)
            
            # Also update heading to roughly match new velocity
            s.theta = reflected_angle + np.random.uniform(-0.3, 0.3)
            s.theta = (s.theta + np.pi) % (2 * np.pi) - np.pi
        
        # Update path
        self.path_x[-1] = new_x
        self.path_y[-1] = new_y
    
    def get_path_array(self) -> np.ndarray:
        """Get path as Nx3 array (x, y, theta)."""
        return np.column_stack([self.path_x, self.path_y, self.path_theta])


def get_flight_dn_bodies(annotations) -> Tuple[Set[int], Set[int]]:
    """
    Get body IDs of flight-related DNs, split by side.
    
    Returns:
        (left_flight_dns, right_flight_dns)
    """
    left_dns = set()
    right_dns = set()
    
    for _, row in annotations.iterrows():
        cell_type = str(row.get("type", ""))
        if cell_type in FLIGHT_DN_TYPES:
            body_id = row["bodyId"]
            side = str(row.get("somaSide", "")).upper()
            if side == "L":
                left_dns.add(body_id)
            elif side == "R":
                right_dns.add(body_id)
    
    return left_dns, right_dns
