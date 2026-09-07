//! Authored inventory, atomic setup edits and resolution into existing field/body inputs.
use crate::{
    attempt::LevelDef, body::ContactRegion, environment::*, native_object::NativeObjectShape,
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
    WornShoes,
    DirtyDishes,
    Laundry,
    SleepingCat,
}
#[derive(Clone, Debug, Serialize, TS)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ToolEffect {
    None,
    Source {
        kind: SourceKind,
        radius: f64,
        rate: f64,
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
    pub contact: Option<NativeObjectShape>,
    pub edible: bool,
}
/// Shared calibration for palette descriptions and physical/sensory resolution.
/// Threat has no catalog entry until its circuit effect is measured.
pub fn tool_def(kind: ToolKind) -> ToolDef {
    let source = |kind, radius, rate| ToolEffect::Source { kind, radius, rate };
    let (contact, edible, minimum_radius, effect) = match kind {
        ToolKind::Fruit => (
            Some(NativeObjectShape::Apple),
            true,
            0.,
            source(SourceKind::AttractiveOdor, 0.75, 1.),
        ),
        ToolKind::Banana => (
            Some(NativeObjectShape::Banana),
            true,
            0.,
            source(SourceKind::AttractiveOdor, 0.75, 1.),
        ),
        // Domestic odor strengths are game assumptions, not measurements of these materials.
        ToolKind::WornShoes => (
            Some(NativeObjectShape::WornShoes),
            false,
            0.,
            source(SourceKind::AttractiveOdor, 0.75, 0.35),
        ),
        ToolKind::DirtyDishes => (
            Some(NativeObjectShape::DirtyDishes),
            false,
            0.,
            source(SourceKind::AttractiveOdor, 0.75, 1.5),
        ),
        ToolKind::Laundry => (
            Some(NativeObjectShape::Laundry),
            false,
            0.,
            source(SourceKind::AttractiveOdor, 0.75, 0.2),
        ),
        ToolKind::SleepingCat => (
            Some(NativeObjectShape::SleepingCat),
            false,
            0.,
            ToolEffect::None,
        ),
        ToolKind::Crumbs => (
            None,
            false,
            0.2,
            source(SourceKind::AttractiveOdor, 0.75, 1.),
        ),
        ToolKind::Vinegar => (
            Some(NativeObjectShape::Vinegar),
            false,
            0.2,
            source(SourceKind::RepellentOdor, 0.75, 1.),
        ),
        ToolKind::Lamp => (None, false, 0.25, source(SourceKind::Lamp, 1.5, 0.4)),
        ToolKind::Shade => (None, false, 0.25, source(SourceKind::Shade, 1.5, 0.2)),
        ToolKind::Fan => (
            Some(NativeObjectShape::Fan),
            false,
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
        footprint_radius: contact.map_or(minimum_radius, |shape| {
            shape.footprint_radius().max(minimum_radius)
        }),
        effect,
        contact,
        edible,
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
        ToolKind::WornShoes,
        ToolKind::DirtyDishes,
        ToolKind::Laundry,
        ToolKind::SleepingCat,
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
#[serde(rename_all = "camelCase")]
pub struct PlacementRules {
    /// Map-owned fan direction in canonical radians; placement edits cannot override it.
    pub fan_heading: f64,
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
    fn canonicalize(&mut self, fan_heading: f64) -> Result<(), String> {
        if self.kind == ToolKind::Fan {
            self.heading = fan_heading;
        }
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
    pub objects: Vec<ContactSurface>,
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
    if !rules.fan_heading.is_finite() || !(0. ..std::f64::consts::TAU).contains(&rules.fan_heading)
    {
        return Err("map fan heading must be finite canonical radians in [0, TAU)".into());
    }
    if rules.inventory.len() > tool_catalog().len()
        || rules.reserved.len() > 256
        || placements.len() > 64
        || level.fixed_objects.len() > 64
    {
        return Err("setup exceeds inventory, reserved-region or placement limits".into());
    }
    let mut remaining = BTreeMap::new();
    for stock in &rules.inventory {
        if stock.count == 0
            || stock.count > 64
            || remaining.insert(stock.kind, stock.count).is_some()
        {
            return Err("inventory needs unique objects and counts in 1..64".into());
        }
    }
    if remaining.values().sum::<u32>() > 64 {
        return Err("inventory limit is 64 total objects".into());
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
        p.canonicalize(rules.fan_heading)?;
    }
    let mut fixed = level.fixed_objects.clone();
    fixed.sort_by_key(|p| p.id);
    for p in &mut fixed {
        p.canonicalize(rules.fan_heading)?;
    }
    let all: Vec<_> = fixed.iter().chain(&placements).collect();
    for i in 0..all.len() {
        let placement = all[i];
        if i > 0 && i != fixed.len() && all[i - 1].id == placement.id {
            return Err("placement IDs must be unique".into());
        }
        let radius = tool_def(placement.kind).footprint_radius;
        // An object's conservative square footprint must fit a room and clear walls and solids.
        if !level.geometry.rooms.iter().any(|r| {
            placement.position.x - radius >= r.min.x
                && placement.position.x + radius <= r.max.x
                && placement.position.z - radius >= r.min.z
                && placement.position.z + radius <= r.max.z
        }) || !level.geometry.contains_body(placement.position, radius)
        {
            return Err(
                "object footprint must fit open floor in one room and clear walls and solids"
                    .into(),
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
            return Err("object overlaps a reserved prop or spawn footprint".into());
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
            return Err("object overlaps the exit opening".into());
        }
        if all[..i].iter().any(|p| {
            placement.position.distance(p.position) <= radius + tool_def(p.kind).footprint_radius
        }) {
            return Err("object footprints must not overlap".into());
        }
        if i >= fixed.len() {
            let count = remaining
                .get_mut(&placement.kind)
                .ok_or("object is not available in this level")?;
            *count = count
                .checked_sub(1)
                .ok_or("no inventory remains for this object")?;
        }
    }
    let mut sources = level.sources.clone();
    let food_defs = &level.food;
    if food_defs.len() > 256
        || food_defs
            .iter()
            .any(|f| !level.geometry.contains_body(f.position, 0.))
    {
        return Err("food requires floor positions and at most 256 surfaces".into());
    }
    let mut food = food_defs
        .iter()
        .enumerate()
        .map(|(id, food)| food.surface(id as u32))
        .collect::<Result<Vec<_>, _>>()?;
    let mut objects = vec![];
    let mut surface_id = food.len() as u32;
    let mut field_config = level.field_config.clone();
    for placement in all {
        let definition = tool_def(placement.kind);
        if let Some(shape) = definition.contact {
            let surfaces =
                shape.placed_surfaces(placement.position, placement.heading, surface_id)?;
            surface_id += surfaces.len() as u32;
            if definition.edible {
                food.extend(surfaces);
            } else {
                objects.extend(surfaces);
            }
        }
        match definition.effect {
            ToolEffect::None => {}
            ToolEffect::Source { kind, radius, rate } => {
                sources.push(Source {
                    position: placement.position,
                    radius,
                    rate,
                    kind,
                });
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
    if sources.len() > 256 || food.len() + objects.len() > 256 || field_config.fans.len() > 64 {
        return Err("resolved setup exceeds field/body source limits".into());
    }
    Ok(ResolvedSetup {
        state: PlacementState {
            placements,
            food,
            objects,
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
            placement.canonicalize(level.placement_rules.fan_heading)?;
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
