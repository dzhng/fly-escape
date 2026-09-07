//! Authored inventory, atomic setup edits and resolution into existing field/body inputs.
use crate::{
    attempt::LevelDef,
    body::ContactRegion,
    environment::*,
    food::{FoodDef, FoodShape},
    surface::ContactSurface,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ToolKind {
    Fruit,
    Banana,
    Crumbs,
    Vinegar,
    Lamp,
    Shade,
    Fan,
}
#[derive(Clone, Debug, Serialize, TS)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ToolEffect {
    Source {
        kind: SourceKind,
        radius: f64,
        rate: f64,
        food: Option<FoodShape>,
    },
    Fan {
        reach: f64,
        half_width: f64,
        speed: f64,
    },
}
#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ToolDef {
    pub kind: ToolKind,
    pub footprint_radius: f64,
    pub effect: ToolEffect,
}
/// Shared calibration for palette descriptions and physical/sensory resolution.
/// Threat has no catalog entry until its circuit effect is measured.
pub fn tool_def(kind: ToolKind) -> ToolDef {
    let source = |kind, radius, rate, food| ToolEffect::Source {
        kind,
        radius,
        rate,
        food,
    };
    let (footprint_radius, effect) = match kind {
        ToolKind::Fruit => (
            FoodShape::Apple.footprint_radius(),
            source(SourceKind::AttractiveOdor, 0.75, 1., Some(FoodShape::Apple)),
        ),
        ToolKind::Banana => (
            FoodShape::Banana.footprint_radius(),
            source(
                SourceKind::AttractiveOdor,
                0.75,
                1.,
                Some(FoodShape::Banana),
            ),
        ),
        ToolKind::Crumbs => (0.2, source(SourceKind::AttractiveOdor, 0.75, 1., None)),
        ToolKind::Vinegar => (0.2, source(SourceKind::RepellentOdor, 0.75, 1., None)),
        ToolKind::Lamp => (0.25, source(SourceKind::Lamp, 1.5, 0.4, None)),
        ToolKind::Shade => (0.25, source(SourceKind::Shade, 1.5, 0.2, None)),
        ToolKind::Fan => (
            0.25,
            ToolEffect::Fan {
                reach: 3.,
                half_width: 0.75,
                speed: 3.,
            },
        ),
    };
    ToolDef {
        kind,
        footprint_radius,
        effect,
    }
}
pub fn tool_catalog() -> Vec<ToolDef> {
    [
        ToolKind::Fruit,
        ToolKind::Banana,
        ToolKind::Crumbs,
        ToolKind::Vinegar,
        ToolKind::Lamp,
        ToolKind::Shade,
        ToolKind::Fan,
    ]
    .into_iter()
    .map(tool_def)
    .collect()
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
pub struct ToolStock {
    pub kind: ToolKind,
    pub count: u32,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize, TS)]
pub struct PlacementRules {
    pub inventory: Vec<ToolStock>,
    /// Solid prop interiors or authored reserved floor, in addition to spawn bodies and exit.
    pub reserved: Vec<ContactRegion>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
pub struct Placement {
    pub id: u32,
    pub kind: ToolKind,
    pub position: Point,
    pub heading: f64,
}
impl Placement {
    fn canonicalize(&mut self) -> Result<(), String> {
        if !self.position.finite() || !self.heading.is_finite() {
            return Err("placement position and heading must be finite".into());
        }
        let heading = self.heading.rem_euclid(std::f64::consts::TAU);
        // Floating-point remainder can round a tiny negative angle up to TAU.
        self.heading = if heading >= std::f64::consts::TAU || heading == 0. {
            0.
        } else {
            heading
        };
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PlacementEdit {
    Place {
        placement: Placement,
    },
    Move {
        id: u32,
        position: Point,
        heading: f64,
    },
    Remove {
        id: u32,
    },
}
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
pub struct PlacementState {
    pub placements: Vec<Placement>,
    pub remaining: Vec<ToolStock>,
    pub food: Vec<ContactSurface>,
}
#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSetup {
    pub state: PlacementState,
    pub sources: Vec<Source>,
    pub field_config: FieldConfig,
}

pub fn resolve_placements(
    level: &LevelDef,
    placements: &[Placement],
) -> Result<ResolvedSetup, String> {
    level.geometry.validate()?;
    let rules = &level.placement_rules;
    if rules.inventory.len() > tool_catalog().len()
        || rules.reserved.len() > 256
        || placements.len() > 64
    {
        return Err("setup exceeds inventory, reserved-region or placement limits".into());
    }
    let mut remaining = BTreeMap::new();
    for stock in &rules.inventory {
        if stock.count == 0
            || stock.count > 64
            || remaining.insert(stock.kind, stock.count).is_some()
        {
            return Err("inventory needs unique tools and counts in 1..64".into());
        }
    }
    if remaining.values().sum::<u32>() > 64 {
        return Err("inventory limit is 64 total tools".into());
    }
    if rules.reserved.iter().any(|r| {
        !r.center.finite()
            || !r.radius.is_finite()
            || r.radius <= 0.
            || level.geometry.room_at(r.center).is_none()
    }) {
        return Err("reserved regions require finite floor centers and positive radii".into());
    }
    let mut placements = placements.to_vec();
    placements.sort_by_key(|p| p.id);
    for p in &mut placements {
        p.canonicalize()?;
    }
    for i in 0..placements.len() {
        let placement = &placements[i];
        if i > 0 && placements[i - 1].id == placement.id {
            return Err("placement IDs must be unique".into());
        }
        let radius = tool_def(placement.kind).footprint_radius;
        // A tool's conservative square footprint must fit a room and clear walls and solids.
        if !level.geometry.rooms.iter().any(|r| {
            placement.position.x - radius >= r.min.x
                && placement.position.x + radius <= r.max.x
                && placement.position.z - radius >= r.min.z
                && placement.position.z + radius <= r.max.z
        }) || !level.geometry.contains_body(placement.position, radius)
        {
            return Err(
                "tool footprint must fit open floor in one room and clear walls and solids".into(),
            );
        }
        if rules
            .reserved
            .iter()
            .any(|r| placement.position.distance(r.center) <= radius + r.radius)
            || level
                .spawn
                .excludes(placement.position, radius + level.body_config.body_radius)
        {
            return Err("tool overlaps a reserved prop or spawn footprint".into());
        }
        let exit = level.exit;
        let dx = exit.b.x - exit.a.x;
        let dz = exit.b.z - exit.a.z;
        let length_squared = dx * dx + dz * dz;
        if !length_squared.is_finite() || length_squared <= 0. {
            return Err("exit opening must have finite nonzero length".into());
        }
        let t = (((placement.position.x - exit.a.x) * dx + (placement.position.z - exit.a.z) * dz)
            / length_squared)
            .clamp(0., 1.);
        if placement.position.distance(Point {
            x: exit.a.x + t * dx,
            z: exit.a.z + t * dz,
        }) <= radius
        {
            return Err("tool overlaps the exit opening".into());
        }
        if placements[..i].iter().any(|p| {
            placement.position.distance(p.position) <= radius + tool_def(p.kind).footprint_radius
        }) {
            return Err("tool footprints must not overlap".into());
        }
        let count = remaining
            .get_mut(&placement.kind)
            .ok_or("tool is not available in this level")?;
        *count = count
            .checked_sub(1)
            .ok_or("no inventory remains for this tool")?;
    }
    let mut sources = level.sources.clone();
    let mut food_defs = level.food.clone();
    if food_defs.len() > 256
        || food_defs
            .iter()
            .any(|f| !level.geometry.contains_body(f.position, 0.))
    {
        return Err("food requires floor positions and at most 256 surfaces".into());
    }
    let mut field_config = level.field_config.clone();
    for placement in &placements {
        match tool_def(placement.kind).effect {
            ToolEffect::Source {
                kind,
                radius,
                rate,
                food,
            } => {
                sources.push(Source {
                    position: placement.position,
                    radius,
                    rate,
                    kind,
                });
                if let Some(shape) = food {
                    food_defs.push(FoodDef {
                        position: placement.position,
                        heading: placement.heading,
                        shape,
                    });
                }
            }
            ToolEffect::Fan {
                reach,
                half_width,
                speed,
            } => field_config.fans.push(FanField {
                position: placement.position,
                heading: placement.heading,
                reach,
                half_width,
                speed,
            }),
        }
    }
    if sources.len() > 256 || food_defs.len() > 256 || field_config.fans.len() > 64 {
        return Err("resolved setup exceeds field/body source limits".into());
    }
    let food = food_defs
        .iter()
        .enumerate()
        .map(|(id, food)| food.surface(id as u32))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ResolvedSetup {
        state: PlacementState {
            placements,
            food,
            remaining: remaining
                .into_iter()
                .map(|(kind, count)| ToolStock { kind, count })
                .collect(),
        },
        sources,
        field_config,
    })
}

/// Build a candidate value; neither success nor failure mutates the caller's setup.
/// Inventory is derived only after validation, so a rejected move spends nothing.
pub fn edit_placements(
    level: &LevelDef,
    current: &[Placement],
    edit: PlacementEdit,
) -> Result<PlacementState, String> {
    let mut candidate = resolve_placements(level, current)?.state.placements;
    match edit {
        PlacementEdit::Place { mut placement } => {
            placement.canonicalize()?;
            if let Some(existing) = candidate.iter().find(|p| p.id == placement.id) {
                if existing != &placement {
                    return Err("placement ID is already in use".into());
                }
            } else {
                candidate.push(placement);
            }
        }
        PlacementEdit::Move {
            id,
            position,
            heading,
        } => {
            let p = candidate
                .iter_mut()
                .find(|p| p.id == id)
                .ok_or("cannot move a missing placement")?;
            p.position = position;
            p.heading = heading;
        }
        PlacementEdit::Remove { id } => candidate.retain(|p| p.id != id),
    }
    Ok(resolve_placements(level, &candidate)?.state)
}
