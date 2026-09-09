use super::*;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FieldConfig {
    pub cell_size: f64,
    /// World units squared per game second.
    pub diffusion: f64,
    /// Fractional loss per game second.
    pub decay: f64,
    pub baseline_brightness: f64,
    pub antenna_offset: f64,
    pub antenna_forward: f64,
    /// Uniform ambient velocity, combined with local fans for advection and body physics.
    pub wind: Point,
    pub fans: Vec<FanField>,
}
impl Default for FieldConfig {
    fn default() -> Self {
        Self {
            cell_size: 0.25,
            diffusion: 0.2,
            decay: 0.1,
            baseline_brightness: 1.,
            antenna_offset: 0.00020207253103162883,
            antenna_forward: 0.0014145078816978175,
            wind: Point::default(),
            fans: vec![],
        }
    }
}
/// A stylized, wall-occluded jet; heading zero is +X and positive turns toward +Z.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FanField {
    pub position: Point,
    pub heading: f64,
    pub reach: f64,
    pub half_width: f64,
    pub speed: f64,
}
impl FanField {
    fn velocity(&self, p: Point, geometry: &Geometry) -> Point {
        let direction = Point {
            x: self.heading.cos(),
            z: self.heading.sin(),
        };
        let delta = Point {
            x: p.x - self.position.x,
            z: p.z - self.position.z,
        };
        let along = delta.x * direction.x + delta.z * direction.z;
        let across = (delta.x * direction.z - delta.z * direction.x).abs();
        if along < 0.
            || along >= self.reach
            || across >= self.half_width
            || !geometry.line_of_sight(self.position, p)
        {
            return Point::default();
        }
        let speed = self.speed * (1. - along / self.reach) * (1. - across / self.half_width);
        Point {
            x: speed * direction.x,
            z: speed * direction.z,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SourceKind {
    AttractiveOdor,
    RepellentOdor,
    Lamp,
    Shade,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
pub struct Source {
    pub position: Point,
    pub radius: f64,
    /// Each odor channel: total cue mass per second. Lamp/shade: peak brightness contribution.
    pub rate: f64,
    pub kind: SourceKind,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExitCue {
    pub position: Point,
    pub room_id: u32,
    pub radius: f64,
    pub strength: f64,
}
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FieldSample {
    pub attractive_odor: f64,
    pub repellent_odor: f64,
    pub brightness: f64,
    pub shade: f64,
    pub exit_cue: f64,
}
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
pub struct SensorySample {
    pub left: FieldSample,
    pub right: FieldSample,
    pub wind: Point,
}
/// Finite modeled brightness ceiling, well above authored room light levels.
/// Saturating each contribution and accumulation also bounds extreme finite source rates.
pub const MAX_FIELD_BRIGHTNESS: f64 = 1_000_000.;

/// Row-major z then x; entries outside open floor (including solids) are None. Values are
/// exactly sample_point at each cell center, including the local exit gate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FieldGrid {
    pub origin: Point,
    pub max: Point,
    pub cell_size: f64,
    pub width: u32,
    pub height: u32,
    pub cells: Vec<Option<FieldSample>>,
    /// Uniform ambient vector for diagnostic labels; local samples use wind_cells.
    pub wind: Point,
    pub wind_cells: Vec<Point>,
}

pub struct FieldSet {
    geometry: Geometry,
    config: FieldConfig,
    exit: Option<ExitCue>,
    origin: Point,
    width: usize,
    height: usize,
    active: Vec<bool>,
    edges: Vec<(usize, usize, f64)>,
    wind: Vec<Point>,
    loss_rate: f64,
    odors: [Vec<f64>; 2],
    scratch: Vec<f64>,
    injection: [Vec<f64>; 2],
    brightness: Vec<f64>,
    shade: Vec<f64>,
}
const MAX_CELLS: usize = 65_536;
const MAX_WORK: usize = 8_000_000;
impl FieldSet {
    pub fn new(
        geometry: Geometry,
        config: FieldConfig,
        sources: Vec<Source>,
        exit: Option<ExitCue>,
    ) -> Result<Self, String> {
        geometry.validate()?;
        if !config.cell_size.is_finite()
            || config.cell_size <= 0.
            || !config.wind.finite()
            || [
                config.diffusion,
                config.decay,
                config.baseline_brightness,
                config.antenna_offset,
                config.antenna_forward,
            ]
            .iter()
            .any(|v| !v.is_finite() || *v < 0.)
        {
            return Err(
                "field config requires finite nonnegative coefficients and positive cell_size"
                    .into(),
            );
        }
        if config.fans.len() > 64 {
            return Err("fan limit 64 exceeded".into());
        }
        for fan in &config.fans {
            if !fan.position.finite()
                || !geometry.contains_body(fan.position, 0.)
                || !fan.heading.is_finite()
                || !fan.reach.is_finite()
                || fan.reach <= 0.
                || !fan.half_width.is_finite()
                || fan.half_width <= 0.
                || !fan.speed.is_finite()
                || fan.speed < 0.
            {
                return Err("fan requires floor position, finite heading, positive reach/width and nonnegative speed".into());
            }
        }
        if sources.len() > 256 {
            return Err("field source limit 256 exceeded".into());
        }
        for s in &sources {
            if !s.position.finite()
                || !geometry.contains_body(s.position, 0.)
                || !s.radius.is_finite()
                || s.radius <= 0.
                || !s.rate.is_finite()
                || s.rate < 0.
            {
                return Err("sources require floor position, positive finite radius and nonnegative finite rate".into());
            }
        }
        if let Some(e) = &exit {
            if !e.position.finite()
                || geometry.room_at(e.position) != Some(e.room_id)
                || !e.radius.is_finite()
                || e.radius <= 0.
                || !e.strength.is_finite()
                || e.strength < 0.
            {
                return Err(
                    "exit cue requires its declared room, positive radius and nonnegative strength"
                        .into(),
                );
            }
        }
        let origin = Point {
            x: geometry
                .rooms
                .iter()
                .map(|r| r.min.x)
                .fold(f64::INFINITY, f64::min),
            z: geometry
                .rooms
                .iter()
                .map(|r| r.min.z)
                .fold(f64::INFINITY, f64::min),
        };
        let max = Point {
            x: geometry
                .rooms
                .iter()
                .map(|r| r.max.x)
                .fold(f64::NEG_INFINITY, f64::max),
            z: geometry
                .rooms
                .iter()
                .map(|r| r.max.z)
                .fold(f64::NEG_INFINITY, f64::max),
        };
        let width = ((max.x - origin.x) / config.cell_size).ceil() as usize;
        let height = ((max.z - origin.z) / config.cell_size).ceil() as usize;
        let count = width
            .checked_mul(height)
            .filter(|n| *n > 0 && *n <= MAX_CELLS)
            .ok_or("field grid limit 65536 cells exceeded (or empty grid)")?;
        // Visibility is evaluated once during construction, not per solver step.
        let work = count
            .saturating_mul(geometry.rooms.len() + geometry.walls.len() + geometry.solids.len())
            .saturating_mul(sources.len() + config.fans.len() + 3);
        if work > MAX_WORK {
            return Err(format!("field topology work limit {MAX_WORK} exceeded: {work} checks; coarsen grid or simplify geometry/sources"));
        }
        let mut set = Self {
            geometry,
            config,
            exit,
            origin,
            width,
            height,
            active: vec![false; count],
            edges: vec![],
            wind: vec![Point::default(); count],
            loss_rate: 0.,
            odors: std::array::from_fn(|_| vec![0.; count]),
            scratch: vec![0.; count],
            injection: std::array::from_fn(|_| vec![0.; count]),
            brightness: vec![0.; count],
            shade: vec![0.; count],
        };
        for i in 0..count {
            set.active[i] = set.geometry.contains_body(set.center(i), 0.);
            if set.active[i] {
                let mut wind = set.config.wind;
                for fan in &set.config.fans {
                    let velocity = fan.velocity(set.center(i), &set.geometry);
                    wind.x += velocity.x;
                    wind.z += velocity.z;
                }
                if !wind.finite() {
                    return Err("fan velocity accumulation overflow".into());
                }
                set.wind[i] = wind;
            }
        }
        for i in 0..count {
            if !set.active[i] {
                continue;
            }
            if i % width + 1 < width {
                set.add_edge(i, i + 1, (set.wind[i].x + set.wind[i + 1].x) / 2.);
            }
            if i / width + 1 < height {
                set.add_edge(i, i + width, (set.wind[i].z + set.wind[i + width].z) / 2.);
            }
        }
        let h = set.config.cell_size;
        let diffusion = set.config.diffusion / (h * h);
        let mut outgoing = vec![set.config.decay; count];
        for &(a, b, velocity) in &set.edges {
            outgoing[a] += diffusion + velocity.max(0.) / h;
            outgoing[b] += diffusion + (-velocity).max(0.) / h;
        }
        set.loss_rate = outgoing.into_iter().fold(0., f64::max);
        if !set.loss_rate.is_finite() {
            return Err("field transport coefficient overflow".into());
        }
        for s in sources {
            let weights: Vec<f64> = (0..count)
                .map(|i| {
                    if set.active[i] && set.geometry.line_of_sight(set.center(i), s.position) {
                        (1. - set.center(i).distance(s.position) / s.radius).max(0.)
                    } else {
                        0.
                    }
                })
                .collect();
            let area_sum = weights.iter().sum::<f64>() * set.config.cell_size.powi(2);
            if matches!(
                s.kind,
                SourceKind::AttractiveOdor | SourceKind::RepellentOdor
            ) && s.rate > 0.
                && area_sum == 0.
            {
                return Err(
                    "odor source footprint has no grid center; enlarge radius or refine grid"
                        .into(),
                );
            }
            for (i, w) in weights.into_iter().enumerate() {
                match s.kind {
                    SourceKind::AttractiveOdor | SourceKind::RepellentOdor => {
                        if area_sum > 0. {
                            set.injection[usize::from(s.kind == SourceKind::RepellentOdor)][i] +=
                                s.rate * w / area_sum;
                        }
                    }
                    SourceKind::Lamp => {
                        set.brightness[i] = (set.brightness[i]
                            + (s.rate * w).min(MAX_FIELD_BRIGHTNESS))
                        .min(MAX_FIELD_BRIGHTNESS)
                    }
                    SourceKind::Shade => {
                        set.shade[i] = (set.shade[i] + (s.rate * w).min(MAX_FIELD_BRIGHTNESS))
                            .min(MAX_FIELD_BRIGHTNESS)
                    }
                }
            }
        }
        for i in 0..count {
            set.brightness[i] = ((set.config.baseline_brightness.min(MAX_FIELD_BRIGHTNESS)
                + set.brightness[i])
                .min(MAX_FIELD_BRIGHTNESS)
                - set.shade[i])
                .max(0.);
        }
        if set
            .injection
            .iter()
            .flatten()
            .chain(&set.brightness)
            .chain(&set.shade)
            .any(|v| !v.is_finite())
        {
            return Err("field source accumulation overflow".into());
        }
        Ok(set)
    }
    fn center(&self, i: usize) -> Point {
        Point {
            x: self.origin.x
                + (i % self.width) as f64 * self.config.cell_size
                + self.config.cell_size / 2.,
            z: self.origin.z
                + (i / self.width) as f64 * self.config.cell_size
                + self.config.cell_size / 2.,
        }
    }
    fn add_edge(&mut self, a: usize, b: usize, wind: f64) {
        if self.active[b] && self.geometry.line_of_sight(self.center(a), self.center(b)) {
            self.edges.push((a, b, wind));
        }
    }
    pub fn geometry(&self) -> &Geometry {
        &self.geometry
    }
    /// Conservative face flux (diffusion plus first-order upwind advection),
    /// explicit decay/source. CFL subdivision gives nonnegative coefficients.
    /// Rejected calls leave state unchanged; caller can use smaller dt.
    pub fn advance(&mut self, dt: f64) -> Result<(), String> {
        if !dt.is_finite() || dt < 0. {
            return Err("field dt must be finite and nonnegative".into());
        }
        if dt == 0. {
            return Ok(());
        }
        let h = self.config.cell_size;
        let steps = (dt * self.loss_rate / 0.9).ceil().max(1.);
        let work = steps * self.active.len() as f64 * 2.;
        if !work.is_finite() || work > MAX_WORK as f64 {
            return Err(format!("field advance work limit {MAX_WORK} cell-substeps exceeded: {work}; reduce dt or transport coefficients"));
        }
        // Bound accumulation before mutating; finite inputs alone do not prevent overflow.
        let bound = self.odors.iter().flatten().sum::<f64>()
            + dt * self.injection.iter().flatten().sum::<f64>();
        if !bound.is_finite() {
            return Err("field concentration overflow; advance rejected".into());
        }
        let step_dt = dt / steps;
        let diffusion = self.config.diffusion / (h * h);
        for (odor, injection) in self.odors.iter_mut().zip(&self.injection) {
            for _ in 0..steps as usize {
                for i in 0..odor.len() {
                    self.scratch[i] =
                        odor[i] * (1. - step_dt * self.config.decay) + step_dt * injection[i];
                }
                for &(a, b, velocity) in &self.edges {
                    let flux = step_dt
                        * (diffusion * (odor[a] - odor[b])
                            + (velocity.max(0.) * odor[a] + velocity.min(0.) * odor[b]) / h);
                    self.scratch[a] -= flux;
                    self.scratch[b] += flux;
                }
                // Only roundoff can cross zero under the CFL condition.
                for value in &mut self.scratch {
                    *value = value.max(0.);
                }
                std::mem::swap(odor, &mut self.scratch);
            }
        }
        Ok(())
    }
    fn cell_at(&self, p: Point) -> Option<usize> {
        if !p.finite() || self.geometry.room_at(p).is_none() {
            return None;
        }
        let x = ((p.x - self.origin.x) / self.config.cell_size).floor() as usize;
        let z = ((p.z - self.origin.z) / self.config.cell_size).floor() as usize;
        if x >= self.width || z >= self.height {
            return None;
        }
        let i = z * self.width + x;
        // A cut cell must not expose values through an internal wall.
        if !self.active[i] || !self.geometry.line_of_sight(p, self.center(i)) {
            return None;
        }
        Some(i)
    }
    pub fn sample_point(&self, p: Point) -> FieldSample {
        if !self.geometry.contains_body(p, 0.) {
            return FieldSample::default();
        }
        let x = (p.x - self.origin.x) / self.config.cell_size - 0.5;
        let z = (p.z - self.origin.z) / self.config.cell_size - 0.5;
        let x0 = x.floor() as isize;
        let z0 = z.floor() as isize;
        let tx = x - x.floor();
        let tz = z - z.floor();
        let mut sample = FieldSample::default();
        let mut total = 0.;
        // Reconstruct from at most four visible centres; renormalize at barriers and edges.
        for (dz, wz) in [(0, 1. - tz), (1, tz)] {
            for (dx, wx) in [(0, 1. - tx), (1, tx)] {
                let (cx, cz) = (x0 + dx, z0 + dz);
                let weight = wx * wz;
                if weight <= 0.
                    || cx < 0
                    || cz < 0
                    || cx >= self.width as isize
                    || cz >= self.height as isize
                {
                    continue;
                }
                let i = cz as usize * self.width + cx as usize;
                if !self.active[i] || !self.geometry.line_of_sight(p, self.center(i)) {
                    continue;
                }
                total += weight;
                sample.attractive_odor += weight * self.odors[0][i];
                sample.repellent_odor += weight * self.odors[1][i];
                sample.brightness += weight * self.brightness[i];
                sample.shade += weight * self.shade[i];
            }
        }
        if total == 0. {
            return sample;
        }
        sample.attractive_odor /= total;
        sample.repellent_odor /= total;
        sample.brightness /= total;
        sample.shade /= total;
        sample.exit_cue = self
            .exit
            .as_ref()
            .filter(|e| {
                self.geometry.room_at(p) == Some(e.room_id)
                    && self.geometry.line_of_sight(p, e.position)
            })
            .map_or(0., |e| {
                e.strength * (1. - p.distance(e.position) / e.radius).max(0.)
            });
        sample
    }
    /// Heading zero is +X; positive turns toward +Z (right), so left is -Z.
    pub fn sample_points(&self, position: Point, heading: f64) -> [Point; 2] {
        let centre = Point {
            x: position.x + heading.cos() * self.config.antenna_forward,
            z: position.z + heading.sin() * self.config.antenna_forward,
        };
        let dx = heading.sin() * self.config.antenna_offset;
        let dz = -heading.cos() * self.config.antenna_offset;
        [
            Point {
                x: centre.x + dx,
                z: centre.z + dz,
            },
            Point {
                x: centre.x - dx,
                z: centre.z - dz,
            },
        ]
    }
    pub fn sample(&self, position: Point, heading: f64, _tick: u32) -> SensorySample {
        let [left, right] = self.sample_points(position, heading);
        SensorySample {
            left: self.sample_point(left),
            right: self.sample_point(right),
            wind: self
                .cell_at(position)
                .map_or(Point::default(), |i| self.wind[i]),
        }
    }
    pub fn export_grid(&self) -> FieldGrid {
        FieldGrid {
            origin: self.origin,
            max: Point {
                x: self.origin.x + self.width as f64 * self.config.cell_size,
                z: self.origin.z + self.height as f64 * self.config.cell_size,
            },
            cell_size: self.config.cell_size,
            width: self.width as u32,
            height: self.height as u32,
            cells: (0..self.active.len())
                .map(|i| self.active[i].then(|| self.sample_point(self.center(i))))
                .collect(),
            wind: self.config.wind,
            wind_cells: self.wind.clone(),
        }
    }
}

#[cfg(test)]
mod reconstruction_tests {
    use super::*;

    fn fixture() -> FieldSet {
        FieldSet::new(
            Geometry {
                rooms: vec![RectRoom {
                    id: 1,
                    min: Point { x: 0., z: 0. },
                    max: Point { x: 4., z: 4. },
                }],
                walls: vec![],
                solids: vec![],
            },
            FieldConfig {
                cell_size: 1.,
                ..FieldConfig::default()
            },
            vec![],
            None,
        )
        .unwrap()
    }
    fn fill(f: &mut FieldSet, value: impl Fn(Point) -> f64) {
        for i in 0..f.active.len() {
            let v = value(f.center(i));
            f.odors[0][i] = v;
            f.odors[1][i] = 2. * v;
            f.brightness[i] = 3. * v;
            f.shade[i] = 4. * v;
        }
    }
    fn assert_sample(s: FieldSample, v: f64) {
        for (actual, expected) in [
            (s.attractive_odor, v),
            (s.repellent_odor, 2. * v),
            (s.brightness, 3. * v),
            (s.shade, 4. * v),
        ] {
            assert!((actual - expected).abs() < 1e-10, "{actual} != {expected}");
        }
    }
    #[test]
    fn constants_survive_domain_edges_and_invalid_points_return_zero() {
        let mut f = fixture();
        fill(&mut f, |_| 7.);
        for p in [
            Point { x: 0., z: 0. },
            Point { x: 4., z: 4. },
            Point { x: 0.1, z: 2.8 },
        ] {
            assert_sample(f.sample_point(p), 7.);
        }
        for p in [
            Point { x: -0.001, z: 2. },
            Point { x: f64::NAN, z: 2. },
            Point {
                x: 2.,
                z: f64::INFINITY,
            },
        ] {
            assert_eq!(f.sample_point(p), FieldSample::default());
        }
    }
    #[test]
    fn linear_fields_are_exact_through_centres_and_former_cell_boundaries() {
        let mut f = fixture();
        fill(&mut f, |p| 1. + 2. * p.x + 3. * p.z);
        for step in 0..=3000 {
            let p = Point {
                x: 0.5 + step as f64 / 1000.,
                z: 1.123,
            };
            assert_sample(f.sample_point(p), 1. + 2. * p.x + 3. * p.z);
        }
        for i in 0..f.active.len() {
            assert_sample(f.sample_point(f.center(i)), f.odors[0][i]);
        }
    }
    #[test]
    fn visible_support_is_bounded_and_does_not_leak_through_walls_or_solids() {
        for solid in [false, true] {
            let mut f = fixture();
            if solid {
                f.geometry.solids.push(SolidProp {
                    furnishing: None,
                    id: 1,
                    min: Point { x: 1.1, z: 0. },
                    max: Point { x: 1.2, z: 4. },
                    height: 1.,
                });
            } else {
                f.geometry.walls.push(Wall {
                    a: Point { x: 1.1, z: 0. },
                    b: Point { x: 1.1, z: 4. },
                });
            }
            fill(&mut f, |p| if p.x < 1.1 { 2. } else { 100. });
            // The containing centre at x=1.5 is hidden, but x=0.5 remains visible.
            assert!(f.cell_at(Point { x: 1.05, z: 2. }).is_none());
            assert_sample(f.sample_point(Point { x: 1.05, z: 2. }), 2.);
            assert_sample(f.sample_point(Point { x: 1.25, z: 2. }), 100.);
            assert_eq!(
                f.sample_point(Point { x: 1.1, z: 2. }),
                FieldSample::default()
            );
        }
        let mut f = fixture();
        fill(&mut f, |p| if p.x < 2. { 0. } else { 10. });
        for n in 0..=100 {
            let s = f.sample_point(Point {
                x: 1.5 + n as f64 / 100.,
                z: 1.8,
            });
            assert!((0. ..=10.).contains(&s.attractive_odor));
        }
        f.active.fill(false);
        assert_eq!(
            f.sample_point(Point { x: 2., z: 2. }),
            FieldSample::default()
        );
    }
}
