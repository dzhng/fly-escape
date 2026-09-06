"""
Visualization for fly arena simulation.

Produces 2D top-down lab-bench sterile aesthetic:
- Light gray arena background
- Blue border (glass edge)
- Orange fly dot
- Gray path history
- Green fruit/odor source
- Thrust/turn motor traces
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Rectangle
from matplotlib.collections import LineCollection
from pathlib import Path
from typing import List, Optional, Tuple
from PIL import Image
import io

try:
    from .arena import Arena, OdorSource
except ImportError:
    from arena import Arena, OdorSource


COLORS = {
    "arena_bg": "#E8E8E8",
    "arena_border": "#87CEEB",
    "fly": "#D2691E",
    "path": "#888888",
    "fruit": "#228B22",
    "vinegar": "#8B0000",
    "light": "#FFD700",
    "shadow": "#2F4F4F",
    "wind": "#87CEEB",
    "wall": "#4A4A4A",
    "jar": "#A0522D",
    "jar_opening": "#90EE90",
    "thrust": "#D2691E",
    "turn": "#4169E1",
    "win": "#00FF00",
}


def setup_arena_axes(ax: plt.Axes, arena: Arena, title: str = ""):
    """Configure axes for arena visualization."""
    cfg = arena.config
    
    ax.set_xlim(0, cfg.width)
    ax.set_ylim(0, cfg.height)
    ax.set_aspect("equal")
    ax.set_facecolor(COLORS["arena_bg"])
    
    border_rect = Rectangle(
        (cfg.border / 2, cfg.border / 2),
        cfg.width - cfg.border,
        cfg.height - cfg.border,
        fill=False,
        edgecolor=COLORS["arena_border"],
        linewidth=3,
    )
    ax.add_patch(border_rect)
    
    ax.set_xticks([])
    ax.set_yticks([])
    
    if title:
        ax.set_title(title, fontsize=11, fontfamily="monospace")


def draw_odor_sources(ax: plt.Axes, arena: Arena):
    """Draw odor sources on arena."""
    for source in arena.odor_sources:
        circle = Circle(
            (source.x, source.y),
            radius=10,
            color=COLORS["fruit"],
            alpha=0.9,
            zorder=5,
        )
        ax.add_patch(circle)
        
        for r_mult in [0.3, 0.6, 0.9]:
            ring = Circle(
                (source.x, source.y),
                radius=source.sigma * r_mult,
                fill=False,
                edgecolor=COLORS["fruit"],
                alpha=0.2,
                linestyle="--",
                linewidth=0.5,
            )
            ax.add_patch(ring)


def draw_fly_path(ax: plt.Axes, arena: Arena, alpha: float = 0.5):
    """Draw fly movement path."""
    if len(arena.path_x) > 1:
        ax.plot(
            arena.path_x,
            arena.path_y,
            color=COLORS["path"],
            alpha=alpha,
            linewidth=1,
            zorder=2,
        )


def draw_fly(ax: plt.Axes, arena: Arena, heading_length: float = 20):
    """Draw fly at current position with heading indicator."""
    fly = Circle(
        (arena.x, arena.y),
        radius=8,
        color=COLORS["fly"],
        zorder=10,
    )
    ax.add_patch(fly)
    
    dx = heading_length * np.cos(arena.theta)
    dy = heading_length * np.sin(arena.theta)
    ax.plot(
        [arena.x, arena.x + dx],
        [arena.y, arena.y + dy],
        color=COLORS["fly"],
        linewidth=2,
        zorder=9,
    )


def plot_motor_traces(
    ax: plt.Axes,
    thrusts: np.ndarray,
    turns: np.ndarray,
    title: str = "DN/MN → thrust / turn",
):
    """Plot thrust and turn motor commands over time."""
    steps = np.arange(len(thrusts))
    
    ax.plot(steps, thrusts, color=COLORS["thrust"], label="thrust", linewidth=1)
    ax.plot(steps, turns, color=COLORS["turn"], label="turn", linewidth=1)
    
    ax.set_xlabel("LIF step")
    ax.set_ylabel("motor vector")
    ax.set_title(title, fontsize=10, fontfamily="monospace")
    ax.legend(loc="upper right", fontsize=8)
    ax.grid(True, alpha=0.3)


def render_frame(
    arena: Arena,
    thrusts: np.ndarray,
    turns: np.ndarray,
    title: str = "MaleCNS LIF fly",
    figsize: Tuple[int, int] = (10, 5),
) -> np.ndarray:
    """Render a single frame as numpy array."""
    fig, (ax_arena, ax_motor) = plt.subplots(1, 2, figsize=figsize)
    
    setup_arena_axes(ax_arena, arena, f"{title} — {'fruit arena' if arena.odor_sources else 'empty sterile arena'}")
    draw_odor_sources(ax_arena, arena)
    draw_fly_path(ax_arena, arena)
    draw_fly(ax_arena, arena)
    
    plot_motor_traces(ax_motor, thrusts, turns)
    
    plt.tight_layout()
    
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, facecolor="white")
    buf.seek(0)
    img = Image.open(buf)
    frame = np.array(img)
    plt.close(fig)
    
    return frame


def save_frame(
    arena: Arena,
    thrusts: np.ndarray,
    turns: np.ndarray,
    path: Path,
    title: str = "MaleCNS LIF fly",
):
    """Save a single frame to file."""
    fig, (ax_arena, ax_motor) = plt.subplots(1, 2, figsize=(10, 5))
    
    setup_arena_axes(ax_arena, arena, f"{title} — {'fruit arena' if arena.odor_sources else 'empty sterile arena'}")
    draw_odor_sources(ax_arena, arena)
    draw_fly_path(ax_arena, arena)
    draw_fly(ax_arena, arena)
    
    plot_motor_traces(ax_motor, thrusts, turns)
    
    plt.tight_layout()
    fig.savefig(path, dpi=100, facecolor="white")
    plt.close(fig)


def save_animation(
    frames: List[np.ndarray],
    path: Path,
    fps: int = 20,
):
    """Save frames as GIF animation."""
    if not frames:
        return
    
    pil_frames = [Image.fromarray(f) for f in frames]
    duration = int(1000 / fps)
    
    pil_frames[0].save(
        path,
        save_all=True,
        append_images=pil_frames[1:],
        duration=duration,
        loop=0,
    )


def plot_path_comparison(
    arena_no_odor: Arena,
    arena_with_odor: Arena,
    metrics_no_odor: dict,
    metrics_with_odor: dict,
    save_path: Optional[Path] = None,
):
    """Plot side-by-side path comparison."""
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    
    ax1, ax2, ax3 = axes
    
    setup_arena_axes(ax1, arena_no_odor, "No odor (baseline)")
    draw_odor_sources(ax1, arena_no_odor)
    draw_fly_path(ax1, arena_no_odor, alpha=0.8)
    start = Circle((arena_no_odor.config.fly_start_x, arena_no_odor.config.fly_start_y), 
                   radius=6, color="blue", alpha=0.5, zorder=8, label="start")
    ax1.add_patch(start)
    end = Circle((arena_no_odor.path_x[-1], arena_no_odor.path_y[-1]), 
                 radius=6, color="red", alpha=0.5, zorder=8, label="end")
    ax1.add_patch(end)
    
    setup_arena_axes(ax2, arena_with_odor, "With fruit odor")
    draw_odor_sources(ax2, arena_with_odor)
    draw_fly_path(ax2, arena_with_odor, alpha=0.8)
    start2 = Circle((arena_with_odor.config.fly_start_x, arena_with_odor.config.fly_start_y), 
                    radius=6, color="blue", alpha=0.5, zorder=8)
    ax2.add_patch(start2)
    end2 = Circle((arena_with_odor.path_x[-1], arena_with_odor.path_y[-1]), 
                  radius=6, color="red", alpha=0.5, zorder=8)
    ax2.add_patch(end2)
    
    labels = ["Mean dist\nto fruit", "Final dist\nto fruit", "Path\nlength", "Heading\nalignment"]
    no_odor_vals = [
        metrics_no_odor.get("mean_distance", 0),
        metrics_no_odor.get("final_distance", 0),
        metrics_no_odor.get("path_length", 0) / 10,
        metrics_no_odor.get("mean_heading_alignment", 0) * 100,
    ]
    with_odor_vals = [
        metrics_with_odor.get("mean_distance", 0),
        metrics_with_odor.get("final_distance", 0),
        metrics_with_odor.get("path_length", 0) / 10,
        metrics_with_odor.get("mean_heading_alignment", 0) * 100,
    ]
    
    x = np.arange(len(labels))
    width = 0.35
    
    ax3.bar(x - width/2, no_odor_vals, width, label="No odor", color=COLORS["path"])
    ax3.bar(x + width/2, with_odor_vals, width, label="With fruit", color=COLORS["fruit"])
    ax3.set_xticks(x)
    ax3.set_xticklabels(labels, fontsize=9)
    ax3.set_title("Chemotaxis metrics", fontsize=10, fontfamily="monospace")
    ax3.legend(loc="upper right", fontsize=8)
    ax3.grid(True, alpha=0.3, axis="y")
    
    plt.tight_layout()
    
    if save_path:
        fig.savefig(save_path, dpi=100, facecolor="white")
    
    plt.close(fig)
    return fig


# ============================================================
# MAZE VISUALIZATION
# ============================================================

def draw_maze_walls(ax: plt.Axes, walls):
    """Draw maze walls."""
    for wall in walls:
        rect = Rectangle(
            (wall.x, wall.y),
            wall.width,
            wall.height,
            color=COLORS["wall"],
            alpha=0.9,
            zorder=3,
        )
        ax.add_patch(rect)


def draw_maze_stimuli(ax: plt.Axes, stimuli):
    """Draw maze stimuli (fruit, vinegar, etc.)."""
    from .maze import StimulusType
    
    stim_colors = {
        StimulusType.FRUIT: COLORS["fruit"],
        StimulusType.VINEGAR: COLORS["vinegar"],
        StimulusType.LIGHT: COLORS["light"],
        StimulusType.SHADOW: COLORS["shadow"],
        StimulusType.WIND: COLORS["wind"],
        StimulusType.JAR_BAIT: COLORS["fruit"],
    }
    
    for stim in stimuli:
        if stim.type == StimulusType.JAR_BAIT:
            continue  # Drawn with jar
        
        color = stim_colors.get(stim.type, COLORS["fruit"])
        
        # Core
        circle = Circle(
            (stim.x, stim.y),
            radius=8,
            color=color,
            alpha=0.9,
            zorder=5,
        )
        ax.add_patch(circle)
        
        # Gradient rings
        for r_mult in [0.3, 0.6]:
            ring = Circle(
                (stim.x, stim.y),
                radius=stim.sigma * r_mult,
                fill=False,
                edgecolor=color,
                alpha=0.2,
                linestyle="--",
                linewidth=0.5,
            )
            ax.add_patch(ring)
        
        # Wind direction arrow
        if stim.type == StimulusType.WIND:
            dx = 20 * np.cos(stim.direction)
            dy = 20 * np.sin(stim.direction)
            ax.arrow(stim.x, stim.y, dx, dy, head_width=6, head_length=4,
                    fc=COLORS["wind"], ec=COLORS["wind"], alpha=0.7, zorder=6)


def draw_jar(ax: plt.Axes, jar, highlight_win: bool = False):
    """Draw jar/trap goal."""
    if jar is None:
        return
    
    # Jar body (arc)
    theta = np.linspace(0, 2 * np.pi, 100)
    x = jar.x + jar.radius * np.cos(theta)
    y = jar.y + jar.radius * np.sin(theta)
    
    # Draw closed part of jar
    start, end = jar.get_opening_arc()
    
    # Create arc for closed portion
    closed_theta = []
    for t in theta:
        t_norm = (t + 2 * np.pi) % (2 * np.pi)
        start_norm = (start + 2 * np.pi) % (2 * np.pi)
        end_norm = (end + 2 * np.pi) % (2 * np.pi)
        
        if start_norm < end_norm:
            if not (start_norm <= t_norm <= end_norm):
                closed_theta.append(t)
        else:
            if t_norm < start_norm and t_norm > end_norm:
                closed_theta.append(t)
    
    if closed_theta:
        closed_x = jar.x + jar.radius * np.cos(closed_theta)
        closed_y = jar.y + jar.radius * np.sin(closed_theta)
        ax.plot(closed_x, closed_y, color=COLORS["jar"], linewidth=4, zorder=7)
    
    # Opening (green arc)
    open_theta = np.linspace(start, end, 30)
    open_x = jar.x + jar.radius * np.cos(open_theta)
    open_y = jar.y + jar.radius * np.sin(open_theta)
    ax.plot(open_x, open_y, color=COLORS["jar_opening"], linewidth=4, zorder=7)
    
    # Interior fill
    if highlight_win:
        interior = Circle(
            (jar.x, jar.y),
            radius=jar.radius - 2,
            color=COLORS["win"],
            alpha=0.3,
            zorder=1,
        )
        ax.add_patch(interior)
    
    # Bait indicator
    if jar.has_bait:
        bait = Circle(
            (jar.x, jar.y),
            radius=5,
            color=COLORS["fruit"],
            alpha=0.6,
            zorder=6,
        )
        ax.add_patch(bait)


def setup_maze_axes(ax: plt.Axes, maze, title: str = ""):
    """Configure axes for maze visualization."""
    ax.set_xlim(0, maze.width)
    ax.set_ylim(0, maze.height)
    ax.set_aspect("equal")
    ax.set_facecolor(COLORS["arena_bg"])
    
    border_rect = Rectangle(
        (2, 2),
        maze.width - 4,
        maze.height - 4,
        fill=False,
        edgecolor=COLORS["arena_border"],
        linewidth=3,
    )
    ax.add_patch(border_rect)
    
    ax.set_xticks([])
    ax.set_yticks([])
    
    if title:
        ax.set_title(title, fontsize=11, fontfamily="monospace")


def draw_fly_at(ax: plt.Axes, x: float, y: float, theta: float, heading_length: float = 15):
    """Draw fly at specific position."""
    fly = Circle(
        (x, y),
        radius=6,
        color=COLORS["fly"],
        zorder=10,
    )
    ax.add_patch(fly)
    
    dx = heading_length * np.cos(theta)
    dy = heading_length * np.sin(theta)
    ax.plot(
        [x, x + dx],
        [y, y + dy],
        color=COLORS["fly"],
        linewidth=2,
        zorder=9,
    )


def draw_path(ax: plt.Axes, path_x, path_y, alpha: float = 0.5):
    """Draw movement path."""
    if len(path_x) > 1:
        ax.plot(
            path_x,
            path_y,
            color=COLORS["path"],
            alpha=alpha,
            linewidth=1,
            zorder=2,
        )


def render_maze_frame(
    maze,
    state,
    thrusts,
    turns,
    title: str = "Maze",
    figsize: Tuple[int, int] = (12, 5),
    won: bool = False,
) -> np.ndarray:
    """Render a maze simulation frame."""
    fig, (ax_maze, ax_motor) = plt.subplots(1, 2, figsize=figsize)
    
    status = "WON!" if won else f"Step {state.step}"
    setup_maze_axes(ax_maze, maze, f"{title} — {status}")
    
    draw_maze_walls(ax_maze, maze.walls)
    draw_maze_stimuli(ax_maze, maze.stimuli)
    draw_jar(ax_maze, maze.jar, highlight_win=won)
    draw_path(ax_maze, state.path_x, state.path_y)
    draw_fly_at(ax_maze, state.x, state.y, state.theta)
    
    # Start marker
    start = Circle(
        (maze.fly_start_x, maze.fly_start_y),
        radius=5,
        color="blue",
        alpha=0.4,
        zorder=4,
    )
    ax_maze.add_patch(start)
    
    if len(thrusts) > 0:
        plot_motor_traces(ax_motor, np.array(thrusts), np.array(turns))
    
    plt.tight_layout()
    
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, facecolor="white")
    buf.seek(0)
    img = Image.open(buf)
    frame = np.array(img)
    plt.close(fig)
    
    return frame


def save_maze_frame(
    maze,
    state,
    thrusts,
    turns,
    path: Path,
    title: str = "Maze",
    won: bool = False,
):
    """Save a maze frame to file."""
    frame = render_maze_frame(maze, state, thrusts, turns, title, won=won)
    img = Image.fromarray(frame)
    img.save(path)


def save_maze_animation(
    frames: List[np.ndarray],
    path: Path,
    fps: int = 20,
):
    """Save maze frames as GIF animation."""
    save_animation(frames, path, fps)
