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
    /// World-space velocity used for odor advection and exported to body physics.
    pub wind: Point,
}
impl Default for FieldConfig {
    fn default() -> Self {
        Self {
            cell_size: 0.25,
            diffusion: 0.2,
            decay: 0.1,
            baseline_brightness: 1.,
            antenna_offset: 0.15,
            wind: Point::default(),
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SourceKind {
    Odor,
    Lamp,
    Shade,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
pub struct Source {
    pub position: Point,
    pub radius: f64,
    /// Odor: total cue mass per second. Lamp/shade: peak brightness contribution.
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
    pub odor: f64,
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
/// Row-major z then x; entries outside the room floors are None. Values are
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
    pub wind: Point,
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
    odor: Vec<f64>,
    scratch: Vec<f64>,
    injection: Vec<f64>,
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
            ]
            .iter()
            .any(|v| !v.is_finite() || *v < 0.)
        {
            return Err(
                "field config requires finite nonnegative coefficients and positive cell_size"
                    .into(),
            );
        }
        if sources.len() > 256 {
            return Err("field source limit 256 exceeded".into());
        }
        for s in &sources {
            if !s.position.finite()
                || geometry.room_at(s.position).is_none()
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
            .saturating_mul(geometry.rooms.len() + geometry.walls.len())
            .saturating_mul(sources.len() + 3);
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
            odor: vec![0.; count],
            scratch: vec![0.; count],
            injection: vec![0.; count],
            brightness: vec![0.; count],
            shade: vec![0.; count],
        };
        for i in 0..count {
            set.active[i] = set.geometry.room_at(set.center(i)).is_some();
        }
        for i in 0..count {
            if !set.active[i] {
                continue;
            }
            if i % width + 1 < width {
                set.add_edge(i, i + 1, set.config.wind.x);
            }
            if i / width + 1 < height {
                set.add_edge(i, i + width, set.config.wind.z);
            }
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
            if s.kind == SourceKind::Odor && s.rate > 0. && area_sum == 0. {
                return Err(
                    "odor source footprint has no grid center; enlarge radius or refine grid"
                        .into(),
                );
            }
            for (i, w) in weights.into_iter().enumerate() {
                match s.kind {
                    SourceKind::Odor => {
                        if area_sum > 0. {
                            set.injection[i] += s.rate * w / area_sum;
                        }
                    }
                    SourceKind::Lamp => set.brightness[i] += s.rate * w,
                    SourceKind::Shade => set.shade[i] += s.rate * w,
                }
            }
        }
        for i in 0..count {
            set.brightness[i] =
                (set.config.baseline_brightness + set.brightness[i] - set.shade[i]).max(0.);
        }
        if set
            .injection
            .iter()
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
    pub fn antenna_offset(&self) -> f64 {
        self.config.antenna_offset
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
        let loss = 4. * self.config.diffusion / (h * h)
            + (self.config.wind.x.abs() + self.config.wind.z.abs()) / h
            + self.config.decay;
        let steps = (dt * loss / 0.9).ceil().max(1.);
        let work = steps * self.odor.len() as f64;
        if !work.is_finite() || work > MAX_WORK as f64 {
            return Err(format!("field advance work limit {MAX_WORK} cell-substeps exceeded: {work}; reduce dt or transport coefficients"));
        }
        // Bound accumulation before mutating; finite inputs alone do not prevent overflow.
        let bound = self.odor.iter().sum::<f64>() + dt * self.injection.iter().sum::<f64>();
        if !bound.is_finite() {
            return Err("field concentration overflow; advance rejected".into());
        }
        let step_dt = dt / steps;
        let diffusion = self.config.diffusion / (h * h);
        for _ in 0..steps as usize {
            for i in 0..self.odor.len() {
                self.scratch[i] =
                    self.odor[i] * (1. - step_dt * self.config.decay) + step_dt * self.injection[i];
            }
            for &(a, b, velocity) in &self.edges {
                let flux = step_dt
                    * (diffusion * (self.odor[a] - self.odor[b])
                        + (velocity.max(0.) * self.odor[a] + velocity.min(0.) * self.odor[b]) / h);
                self.scratch[a] -= flux;
                self.scratch[b] += flux;
            }
            // Only roundoff can cross zero under the CFL condition.
            for value in &mut self.scratch {
                *value = value.max(0.);
            }
            std::mem::swap(&mut self.odor, &mut self.scratch);
        }
        Ok(())
    }
    pub fn sample_point(&self, p: Point) -> FieldSample {
        if !p.finite() || self.geometry.room_at(p).is_none() {
            return FieldSample::default();
        }
        let x = ((p.x - self.origin.x) / self.config.cell_size).floor() as usize;
        let z = ((p.z - self.origin.z) / self.config.cell_size).floor() as usize;
        if x >= self.width || z >= self.height {
            return FieldSample::default();
        }
        let i = z * self.width + x;
        // A cut cell must not expose values through an internal wall.
        if !self.active[i] || !self.geometry.line_of_sight(p, self.center(i)) {
            return FieldSample::default();
        }
        let exit_cue = self
            .exit
            .as_ref()
            .filter(|e| {
                self.geometry.room_at(p) == Some(e.room_id)
                    && self.geometry.line_of_sight(p, e.position)
            })
            .map_or(0., |e| {
                e.strength * (1. - p.distance(e.position) / e.radius).max(0.)
            });
        FieldSample {
            odor: self.odor[i],
            brightness: self.brightness[i],
            shade: self.shade[i],
            exit_cue,
        }
    }
    /// Heading zero is +X; positive turns toward +Z (right), so left is -Z.
    /// tick is reserved for time-varying cues; static cues depend on advanced state.
    pub fn sample(&self, position: Point, heading: f64, _tick: u32) -> SensorySample {
        let dx = heading.sin() * self.config.antenna_offset;
        let dz = -heading.cos() * self.config.antenna_offset;
        SensorySample {
            left: self.sample_point(Point {
                x: position.x + dx,
                z: position.z + dz,
            }),
            right: self.sample_point(Point {
                x: position.x - dx,
                z: position.z - dz,
            }),
            wind: self.config.wind,
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
            cells: (0..self.odor.len())
                .map(|i| self.active[i].then(|| self.sample_point(self.center(i))))
                .collect(),
            wind: self.config.wind,
        }
    }
}
