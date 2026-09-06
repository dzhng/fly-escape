"""
Multi-room house level: Help the Fly Escape!

LEVEL DESIGN (LAYOUT LOCK from David):
- 3-4 rooms between spawn and glowing orange exit
- Exit door on RIGHT WALL of final room (not facing hallway)
- Hallway enters final room from LEFT (fly must enter room to see exit)
- OCCLUSION: From hallway, fly CANNOT see/sense exit (no LOS, no attract)
- Near-field magnet only works once fly enters room and has LOS
- Mixed obstacle rooms (shadow, light, attract, repel, dead ends)
- Placeable threat for takeoff boost in long hallways

ART VIBE:
- Cool/muted interior rooms
- Warm orange glowing exit (visual + near-field attract)
- Whimsical house aesthetic
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional

try:
    from .maze import Maze, Wall, Stimulus, StimulusType, Jar
except ImportError:
    from maze import Maze, Wall, Stimulus, StimulusType, Jar


def create_house_escape_level(
    include_toolkit: bool = True,
    include_threat: bool = True,
    include_zappers: bool = False,
    zapper_seed: int = 12345,
    n_zappers: int = 3,
) -> Maze:
    """
    Create the first 'Help the Fly Escape' level (LAYOUT LOCK).
    
    Layout (4 rooms + EXIT ROOM with occluded exit):
    
    ┌──────────────────────────────────────────────────────────────────────────┐
    │                                                                          │
    │   SPAWN      ROOM 1         ROOM 2         CORRIDOR   ┌─────────────────┤
    │    ●═══════════════════════════════════════════════════╡    EXIT ROOM   │
    │   (fly)    (shadow)       (light)        (long)       │                 │
    │              ▓▓▓            ○○○                        │        ☀ EXIT  │
    │         ════════════   ════════════                    │  (right wall)  │
    │              │              │                          └─────────────────┤
    │         DEAD END 1    DEAD END 2                                         │
    │              ×              ×                                             │
    └──────────────────────────────────────────────────────────────────────────┘
    
    EXIT ROOM DETAIL (LAYOUT LOCK):
            ┌─────────────────┐
            │   OCCLUSION     │
    ────────┤   BAFFLE ▌      │    EXIT is on RIGHT WALL
            │   doorway ↘     ├──☀ (can't see from hallway!)
            │                 │
            └─────────────────┘
    
    Room types:
    - Room 1: Shadow room (fly lingers - AOTU scototaxis)
    - Room 2: Light room (fly avoids - AOTU scototaxis)  
    - Corridor: Long hallway (needs flight)
    - Exit Room: L-shaped entry, exit on right wall (OCCLUDED from hallway)
    - Dead ends: Vinegar to discourage entry
    
    Toolkit items (if include_toolkit):
    - Fruit crumbs to guide path
    - Threat behind spawn to encourage takeoff
    """
    
    width = 1300
    height = 450
    
    maze = Maze(
        width=width,
        height=height,
        fly_start_x=80,
        fly_start_y=225,
        fly_start_theta=0,
    )
    
    wall_t = 20
    
    # ========== OUTER WALLS ==========
    maze.walls.extend([
        Wall(0, 0, width, wall_t),
        Wall(0, height - wall_t, width, wall_t),
        Wall(0, 0, wall_t, height),
        Wall(width - wall_t, 0, wall_t, height),
    ])
    
    # ========== ROOM DIVIDERS ==========
    doorway_h = 120
    main_corridor_y = (height - doorway_h) // 2
    
    # Wall between Room 1 (shadow) and Room 2 (light)
    wall_x1 = 280
    maze.walls.extend([
        Wall(wall_x1, wall_t, wall_t, main_corridor_y - wall_t),
        Wall(wall_x1, main_corridor_y + doorway_h, wall_t, 
             height - main_corridor_y - doorway_h - wall_t),
    ])
    
    # Wall between Room 2 and Corridor
    wall_x2 = 550
    maze.walls.extend([
        Wall(wall_x2, wall_t, wall_t, main_corridor_y - wall_t),
        Wall(wall_x2, main_corridor_y + doorway_h, wall_t,
             height - main_corridor_y - doorway_h - wall_t),
    ])
    
    # ========== EXIT ROOM (LAYOUT LOCK) ==========
    # Exit room is enclosed - hallway enters from LEFT, exit is on RIGHT WALL
    # Occlusion: fly cannot see exit until inside the room
    
    exit_room_x = 900
    exit_room_w = 350
    exit_room_h = 200
    exit_room_y = 125
    
    # Exit room TOP wall (solid)
    maze.walls.append(Wall(
        exit_room_x, exit_room_y + exit_room_h,
        exit_room_w, wall_t
    ))
    
    # Exit room BOTTOM wall (solid)
    maze.walls.append(Wall(
        exit_room_x, exit_room_y - wall_t,
        exit_room_w, wall_t
    ))
    
    # Exit room LEFT wall - partial with doorway for entry
    entry_doorway_h = 100
    entry_doorway_y = 175
    
    # Below doorway
    maze.walls.append(Wall(
        exit_room_x - wall_t, exit_room_y - wall_t,
        wall_t, entry_doorway_y - exit_room_y + wall_t
    ))
    # Above doorway  
    maze.walls.append(Wall(
        exit_room_x - wall_t, entry_doorway_y + entry_doorway_h,
        wall_t, exit_room_y + exit_room_h - entry_doorway_y - entry_doorway_h + wall_t
    ))
    
    # ========== OCCLUSION BAFFLE ==========
    # Internal wall that blocks LOS from entry doorway to exit
    # Fly must go AROUND this to see the exit on the right wall
    
    baffle_len = 100
    baffle_x = exit_room_x + 80
    baffle_y = exit_room_y + exit_room_h - baffle_len - wall_t
    
    maze.walls.append(Wall(
        baffle_x, baffle_y,
        wall_t, baffle_len
    ))
    
    # ========== DEAD ENDS ==========
    dead_end_depth = 70
    
    # Dead end below Room 1
    maze.walls.extend([
        Wall(140, wall_t, wall_t, dead_end_depth),
        Wall(230, wall_t, wall_t, dead_end_depth),
        Wall(140, wall_t + dead_end_depth, 90 + wall_t, wall_t),
    ])
    
    # Dead end below Room 2
    maze.walls.extend([
        Wall(380, wall_t, wall_t, dead_end_depth),
        Wall(470, wall_t, wall_t, dead_end_depth),
        Wall(380, wall_t + dead_end_depth, 90 + wall_t, wall_t),
    ])
    
    # ========== OBSTACLE ZONES ==========
    
    # Room 1: Shadow zone
    maze.stimuli.append(Stimulus(
        type=StimulusType.SHADOW,
        x=170,
        y=225,
        intensity=1.5,
        sigma=70,
    ))
    
    # Room 2: Light zone
    maze.stimuli.append(Stimulus(
        type=StimulusType.LIGHT,
        x=420,
        y=225,
        intensity=1.5,
        sigma=70,
    ))
    
    # Dead ends: Vinegar
    maze.stimuli.append(Stimulus(
        type=StimulusType.VINEGAR,
        x=185,
        y=55,
        intensity=0.8,
        sigma=35,
    ))
    maze.stimuli.append(Stimulus(
        type=StimulusType.VINEGAR,
        x=425,
        y=55,
        intensity=0.8,
        sigma=35,
    ))
    
    # ========== EXIT (RIGHT WALL OF EXIT ROOM) ==========
    # Exit is on the RIGHT side of the exit room
    exit_x = exit_room_x + exit_room_w - 50
    exit_y = exit_room_y + exit_room_h // 2
    
    # Near-field magnet: small sigma so it only attracts when fly is IN the room
    maze.stimuli.append(Stimulus(
        type=StimulusType.EXIT,
        x=exit_x,
        y=exit_y,
        intensity=1.8,
        sigma=50,
    ))
    
    # Exit goal zone (Jar mechanics for win detection)
    maze.jar = Jar(
        x=exit_x,
        y=exit_y,
        radius=35,
        opening_direction=np.pi,
        opening_width=0.9,
        has_bait=False,
    )
    
    # ========== TOOLKIT: TRAIL CRUMBS (NOT LANDABLE) ==========
    if include_toolkit:
        # CRUMB type: Attracts via odor but fly CANNOT land on these
        # This prevents fly from getting stuck on trail markers
        
        # Crumb 1: Just past spawn, start the trail
        maze.stimuli.append(Stimulus(
            type=StimulusType.CRUMB,
            x=150,
            y=225,
            intensity=0.8,
            sigma=60,
        ))
        
        # Crumb 2: Through Room 1 (shadow) doorway
        maze.stimuli.append(Stimulus(
            type=StimulusType.CRUMB,
            x=300,
            y=225,
            intensity=0.9,
            sigma=60,
        ))
        
        # Crumb 3: Past Room 1, before Room 2
        maze.stimuli.append(Stimulus(
            type=StimulusType.CRUMB,
            x=420,
            y=280,  # Upper path, away from light center at y=225
            intensity=0.9,
            sigma=55,
        ))
        
        # Crumb 4: Through Room 2 (light) doorway - upper path
        maze.stimuli.append(Stimulus(
            type=StimulusType.CRUMB,
            x=560,
            y=290,
            intensity=0.9,
            sigma=55,
        ))
        
        # Crumb 5: Mid-corridor
        maze.stimuli.append(Stimulus(
            type=StimulusType.CRUMB,
            x=700,
            y=225,
            intensity=0.9,
            sigma=55,
        ))
        
        # Crumb 6: Near exit room entry
        maze.stimuli.append(Stimulus(
            type=StimulusType.CRUMB,
            x=850,
            y=225,
            intensity=1.0,
            sigma=50,
        ))
        
        # Crumb 7: Inside exit room, just past entry (before baffle)
        maze.stimuli.append(Stimulus(
            type=StimulusType.CRUMB,
            x=exit_room_x + 50,
            y=entry_doorway_y + entry_doorway_h // 2,
            intensity=1.0,
            sigma=45,
        ))
        
        # Crumb 8: Inside exit room, around baffle (lower path)
        maze.stimuli.append(Stimulus(
            type=StimulusType.CRUMB,
            x=exit_room_x + 120,
            y=exit_room_y + 40,  # Below baffle
            intensity=1.1,
            sigma=45,
        ))
        
        # Crumb 9: Final approach to exit (strong pull)
        maze.stimuli.append(Stimulus(
            type=StimulusType.CRUMB,
            x=exit_room_x + 220,
            y=exit_y,
            intensity=1.2,
            sigma=50,
        ))
    
    # ========== THREAT (TAKEOFF HELPER) ==========
    if include_threat:
        # Threat behind spawn to encourage immediate takeoff
        maze.stimuli.append(Stimulus(
            type=StimulusType.THREAT,
            x=35,
            y=225,
            intensity=1.2,
            sigma=80,
        ))
        
        # Threat in Room 1 to push forward (not directly on path)
        maze.stimuli.append(Stimulus(
            type=StimulusType.THREAT,
            x=200,
            y=100,  # Below main path
            intensity=0.7,
            sigma=60,
        ))
        
        # Threat in corridor to maintain momentum
        maze.stimuli.append(Stimulus(
            type=StimulusType.THREAT,
            x=650,
            y=350,
            intensity=0.6,
            sigma=50,
        ))
    
    # ========== ZAPPERS (ENVIRONMENT HAZARD) ==========
    if include_zappers and n_zappers > 0:
        # Randomly scatter zappers based on level seed
        rng = np.random.default_rng(zapper_seed)
        
        # Define valid zapper zones (avoid spawn area, exit room, and main trail)
        # Zappers go in "off-path" areas to punish bad navigation
        zapper_zones = [
            # Room 1 lower area (dead end adjacent)
            (140, 250, 80, 130),  # (x_min, x_max, y_min, y_max)
            # Room 2 lower area (dead end adjacent)
            (380, 520, 80, 130),
            # Corridor upper area
            (600, 800, 300, 400),
            # Exit room upper area (above main path)
            (920, 1100, 280, 380),
        ]
        
        placed = 0
        attempts = 0
        while placed < n_zappers and attempts < 50:
            zone = zapper_zones[rng.integers(len(zapper_zones))]
            x = rng.uniform(zone[0], zone[1])
            y = rng.uniform(zone[2], zone[3])
            
            # Don't place too close to spawn or exit
            dist_to_spawn = np.sqrt((x - maze.fly_start_x)**2 + (y - maze.fly_start_y)**2)
            dist_to_exit = np.sqrt((x - exit_x)**2 + (y - exit_y)**2)
            
            if dist_to_spawn > 100 and dist_to_exit > 80:
                maze.stimuli.append(Stimulus(
                    type=StimulusType.ZAPPER,
                    x=x,
                    y=y,
                    intensity=1.0,  # Visual glow intensity
                    sigma=25.0,     # Kill radius (contact = death)
                ))
                placed += 1
            attempts += 1
    
    return maze


def create_minimal_house_level(
    include_zappers: bool = False,
    zapper_seed: int = 12345,
    n_zappers: int = 2,
) -> Maze:
    """
    Minimal 3-room version for faster testing (LAYOUT LOCK compliant).
    
    Layout:
    ┌──────────────────────────────────────────────────────┐
    │  SPAWN      ROOM 1      CORRIDOR   ┌────────────────┤
    │   ●══════════════════════════════════╡  EXIT ROOM   │
    │           (shadow)                  │  BAFFLE ▌ ☀   │
    │                                      └────────────────┤
    └──────────────────────────────────────────────────────┘
    """
    width = 900
    height = 350
    
    maze = Maze(
        width=width,
        height=height,
        fly_start_x=60,
        fly_start_y=175,
        fly_start_theta=0,
    )
    
    wall_t = 15
    
    # Outer walls
    maze.walls.extend([
        Wall(0, 0, width, wall_t),
        Wall(0, height - wall_t, width, wall_t),
        Wall(0, 0, wall_t, height),
        Wall(width - wall_t, 0, wall_t, height),
    ])
    
    # Room dividers with doorways
    doorway_h = 100
    doorway_y = (height - doorway_h) // 2
    
    # Wall between Room 1 and Corridor
    wall_x1 = 250
    maze.walls.extend([
        Wall(wall_x1, wall_t, wall_t, doorway_y - wall_t),
        Wall(wall_x1, doorway_y + doorway_h, wall_t,
             height - doorway_y - doorway_h - wall_t),
    ])
    
    # ========== EXIT ROOM (LAYOUT LOCK) ==========
    exit_room_x = 600
    exit_room_w = 250
    exit_room_h = 150
    exit_room_y = 100
    
    # Exit room TOP wall
    maze.walls.append(Wall(
        exit_room_x, exit_room_y + exit_room_h,
        exit_room_w, wall_t
    ))
    
    # Exit room BOTTOM wall
    maze.walls.append(Wall(
        exit_room_x, exit_room_y - wall_t,
        exit_room_w, wall_t
    ))
    
    # Exit room LEFT wall - partial with doorway
    entry_doorway_h = 80
    entry_doorway_y = 135
    
    maze.walls.append(Wall(
        exit_room_x - wall_t, exit_room_y - wall_t,
        wall_t, entry_doorway_y - exit_room_y + wall_t
    ))
    maze.walls.append(Wall(
        exit_room_x - wall_t, entry_doorway_y + entry_doorway_h,
        wall_t, exit_room_y + exit_room_h - entry_doorway_y - entry_doorway_h + wall_t
    ))
    
    # Occlusion baffle
    baffle_len = 70
    baffle_x = exit_room_x + 60
    baffle_y = exit_room_y + exit_room_h - baffle_len - wall_t
    
    maze.walls.append(Wall(
        baffle_x, baffle_y,
        wall_t, baffle_len
    ))
    
    # Room 1: Shadow zone
    maze.stimuli.append(Stimulus(
        type=StimulusType.SHADOW,
        x=150,
        y=175,
        intensity=1.2,
        sigma=60,
    ))
    
    # Exit on RIGHT WALL of exit room
    exit_x = exit_room_x + exit_room_w - 40
    exit_y = exit_room_y + exit_room_h // 2
    
    maze.stimuli.append(Stimulus(
        type=StimulusType.EXIT,
        x=exit_x,
        y=exit_y,
        intensity=1.5,
        sigma=45,
    ))
    
    # Exit goal
    maze.jar = Jar(
        x=exit_x,
        y=exit_y,
        radius=30,
        opening_direction=np.pi,
        opening_width=0.85,
        has_bait=False,
    )
    
    # TUNED TRAIL: Non-landable crumbs guide the fly through
    
    # Crumb 1: Past spawn
    maze.stimuli.append(Stimulus(
        type=StimulusType.CRUMB,
        x=150,
        y=175,
        intensity=0.8,
        sigma=55,
    ))
    
    # Crumb 2: Through Room 1 doorway
    maze.stimuli.append(Stimulus(
        type=StimulusType.CRUMB,
        x=265,
        y=175,
        intensity=0.9,
        sigma=55,
    ))
    
    # Crumb 3: Mid-corridor
    maze.stimuli.append(Stimulus(
        type=StimulusType.CRUMB,
        x=420,
        y=175,
        intensity=0.9,
        sigma=55,
    ))
    
    # Crumb 4: Near exit room entry
    maze.stimuli.append(Stimulus(
        type=StimulusType.CRUMB,
        x=560,
        y=175,
        intensity=1.0,
        sigma=50,
    ))
    
    # Crumb 5: Inside exit room, just past entry
    maze.stimuli.append(Stimulus(
        type=StimulusType.CRUMB,
        x=exit_room_x + 40,
        y=entry_doorway_y + entry_doorway_h // 2,
        intensity=1.0,
        sigma=45,
    ))
    
    # Crumb 6: Around baffle (lower path)
    maze.stimuli.append(Stimulus(
        type=StimulusType.CRUMB,
        x=exit_room_x + 100,
        y=exit_room_y + 30,  # Below baffle
        intensity=1.1,
        sigma=45,
    ))
    
    # Crumb 7: Final approach to exit
    maze.stimuli.append(Stimulus(
        type=StimulusType.CRUMB,
        x=exit_room_x + 170,
        y=exit_y,
        intensity=1.2,
        sigma=45,
    ))
    
    # Threat for takeoff
    maze.stimuli.append(Stimulus(
        type=StimulusType.THREAT,
        x=35,
        y=175,
        intensity=1.2,
        sigma=70,
    ))
    
    # ========== ZAPPERS (ENVIRONMENT HAZARD) ==========
    if include_zappers and n_zappers > 0:
        rng = np.random.default_rng(zapper_seed)
        
        # Zapper zones for minimal level (off main path)
        zapper_zones = [
            # Room 1 upper area
            (120, 220, 230, 300),
            # Corridor lower area
            (300, 500, 50, 120),
            # Exit room upper area
            (620, 780, 220, 280),
        ]
        
        placed = 0
        attempts = 0
        while placed < n_zappers and attempts < 30:
            zone = zapper_zones[rng.integers(len(zapper_zones))]
            x = rng.uniform(zone[0], zone[1])
            y = rng.uniform(zone[2], zone[3])
            
            dist_to_spawn = np.sqrt((x - maze.fly_start_x)**2 + (y - maze.fly_start_y)**2)
            dist_to_exit = np.sqrt((x - exit_x)**2 + (y - exit_y)**2)
            
            if dist_to_spawn > 80 and dist_to_exit > 60:
                maze.stimuli.append(Stimulus(
                    type=StimulusType.ZAPPER,
                    x=x,
                    y=y,
                    intensity=1.0,
                    sigma=20.0,  # Kill radius
                ))
                placed += 1
            attempts += 1
    
    return maze


if __name__ == "__main__":
    maze = create_house_escape_level()
    print(f"House Escape Level (LAYOUT LOCK):")
    print(f"  Arena: {maze.width}x{maze.height}")
    print(f"  Walls: {len(maze.walls)}")
    print(f"  Stimuli: {len(maze.stimuli)}")
    for s in maze.stimuli:
        print(f"    {s.type.value}: ({s.x}, {s.y}) σ={s.sigma}")
    print(f"  Exit (Jar): {maze.jar is not None}")
    if maze.jar:
        print(f"    Position: ({maze.jar.x}, {maze.jar.y})")
        print(f"    Opening direction: {np.degrees(maze.jar.opening_direction):.0f}°")
