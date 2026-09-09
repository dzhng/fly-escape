//! Identity and complete observations at the asynchronous optical boundary.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct EyeProfile {
    pub profile_hash: String,
    pub layout_hash: String,
    pub rig_hash: String,
    pub color_model_hash: String,
    pub width: u32,
    pub height: u32,
    pub sample_count: u32,
}

impl EyeProfile {
    pub fn validate(&self) -> Result<(), String> {
        if [
            &self.profile_hash,
            &self.layout_hash,
            &self.rig_hash,
            &self.color_model_hash,
        ]
        .iter()
        .any(|hash| !is_hash(hash))
            || !(1..=256).contains(&self.width)
            || !(1..=256).contains(&self.height)
            || self.sample_count == 0
            || self.sample_count > self.width * self.height
        {
            return Err("invalid retinal profile identity or dimensions".into());
        }
        Ok(())
    }

    pub fn bytes_per_fly(&self) -> usize {
        self.sample_count as usize * 2 * 3
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RetinalConfig {
    pub client_generation: u32,
    pub scene_id: String,
    pub map_hash: String,
    pub profile: EyeProfile,
}

impl RetinalConfig {
    pub fn validate(&self) -> Result<(), String> {
        self.profile.validate()?;
        if self.scene_id.is_empty() || self.scene_id.len() > 256 || !is_hash(&self.map_hash) {
            return Err("retinal configuration requires a scene identity and map SHA-256".into());
        }
        Ok(())
    }
}

/// Full native body transform; capture applies the immutable eye mounts to it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct EyePose {
    pub fly_id: u32,
    pub position: [f64; 3],
    pub rotation: [f64; 4],
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VisionRequest {
    pub attempt_id: String,
    pub client_generation: u32,
    pub tick: u32,
    pub profile_hash: String,
    pub scene_id: String,
    /// Ascending active fly IDs also define the RGB byte order.
    pub poses: Vec<EyePose>,
}

impl VisionRequest {
    pub(crate) fn validate_poses(&self) -> Result<(), String> {
        if self.poses.len() > 16
            || self
                .poses
                .windows(2)
                .any(|pair| pair[0].fly_id >= pair[1].fly_id)
            || self.poses.iter().any(|pose| {
                pose.position
                    .iter()
                    .chain(&pose.rotation)
                    .any(|v| !v.is_finite())
                    || (pose.rotation.iter().map(|v| v * v).sum::<f64>() - 1.).abs() > 1e-6
            })
        {
            return Err(
                "retinal poses must be finite, normalized and ordered for at most sixteen flies"
                    .into(),
            );
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RetinaBatch {
    pub request: VisionRequest,
    /// Fly order, then L/R eye, sample, and linear R/G/B bytes.
    #[ts(type = "Uint8Array")]
    pub rgb: Vec<u8>,
}

impl RetinaBatch {
    pub(crate) fn validate(
        &self,
        pending: &VisionRequest,
        profile: &EyeProfile,
    ) -> Result<(), String> {
        self.request.validate_poses()?;
        if &self.request != pending {
            return Err("retinal batch does not match the pending request".into());
        }
        if self.rgb.len() != pending.poses.len() * profile.bytes_per_fly() {
            return Err(
                "retinal batch requires both complete RGB eyes for every active fly".into(),
            );
        }
        Ok(())
    }
}

pub(crate) fn is_hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
