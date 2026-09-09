//! Fixed all-fly retinal slots distinguish present black eyes from absent input.
use super::*;
use crate::vision::{EyePose, RetinaBatch, VisionRequest};
pub(super) fn validate_frame(
    attempt_id: &str,
    layout: &RecordLayout,
    frame: &AttemptFrame,
) -> Result<(), String> {
    match (&layout.retinal_config, &frame.retina) {
        (None, None) => Ok(()),
        (Some(config), Some(batch)) => {
            batch.validate(&batch.request, &config.profile)?;
            let request = &batch.request;
            if request.attempt_id != attempt_id
                || request.tick != frame.tick
                || request.client_generation != config.client_generation
                || request.profile_hash != config.profile.profile_hash
                || request.scene_id != config.scene_id
            {
                return Err("retinal record identity mismatch".into());
            }
            for pose in &request.poses {
                let fly = frame
                    .flies
                    .get(pose.fly_id as usize)
                    .ok_or("retinal fly outside frame")?;
                let start = fly.motion.first().ok_or("missing input motion")?;
                if pose.position
                    != [
                        fly.input_pose.position.x,
                        start.height,
                        fly.input_pose.position.z,
                    ]
                    || pose.rotation != start.rotation
                {
                    return Err("retinal input transform differs from recorded motion start".into());
                }
            }
            if frame
                .flies
                .iter()
                .any(|fly| fly.neural.is_some() != request.poses.iter().any(|p| p.fly_id == fly.id))
            {
                return Err("retinal presence differs from consumed neural input".into());
            }
            Ok(())
        }
        _ => Err("retinal record profile or input missing".into()),
    }
}
pub(super) fn encode_fly(
    layout: &RecordLayout,
    frame: &AttemptFrame,
    id: usize,
    rgb: &mut Vec<u8>,
) -> bool {
    let width = layout.retina_bytes_per_fly();
    if let Some(batch) = &frame.retina {
        if let Some(index) = batch
            .request
            .poses
            .iter()
            .position(|pose| pose.fly_id as usize == id)
        {
            rgb.extend_from_slice(&batch.rgb[index * width..(index + 1) * width]);
            return true;
        }
    }
    rgb.resize(rgb.len() + width, 0);
    false
}
pub(super) fn validate_chunk(chunk: &PackedChunk, layout: &RecordLayout) -> Result<(), String> {
    if chunk.map_hash.as_ref() != layout.retinal_config.as_ref().map(|c| &c.map_hash)
        || chunk.profile_hash.as_ref()
            != layout
                .retinal_config
                .as_ref()
                .map(|c| &c.profile.profile_hash)
        || chunk.scene_id.as_ref() != layout.retinal_config.as_ref().map(|c| &c.scene_id)
        || chunk.retina_rgb.len()
            != chunk.tick_count as usize * chunk.fly_count as usize * layout.retina_bytes_per_fly()
    {
        return Err("retinal chunk identity or length mismatch".into());
    }
    Ok(())
}
pub(super) fn decode_frame(
    chunk: &PackedChunk,
    layout: &RecordLayout,
    tick: usize,
) -> Result<Option<RetinaBatch>, String> {
    let Some(config) = &layout.retinal_config else {
        return Ok(None);
    };
    let width = layout.retina_bytes_per_fly();
    let mut poses = Vec::new();
    let mut rgb = Vec::new();
    for id in 0..chunk.fly_count as usize {
        let record = tick * chunk.fly_count as usize + id;
        let flags = chunk.states[record * STATE_STRIDE + 2];
        let bytes = &chunk.retina_rgb[record * width..(record + 1) * width];
        if (flags & 4 != 0) != (flags & 2 != 0) {
            return Err("retinal presence differs from neural input".into());
        }
        if flags & 4 != 0 {
            let v = &chunk.values[record * layout.value_stride()..];
            let pose = EyePose {
                fly_id: id as u32,
                position: [v[0], v[28], v[1]],
                rotation: [v[29], v[30], v[31], v[32]],
            };
            poses.push(pose);
            rgb.extend_from_slice(bytes);
        } else if bytes.iter().any(|byte| *byte != 0) {
            return Err("absent retinal slot contains bytes".into());
        }
    }
    let request = VisionRequest {
        attempt_id: chunk.attempt_id.clone(),
        client_generation: config.client_generation,
        tick: chunk.start_tick + tick as u32,
        profile_hash: config.profile.profile_hash.clone(),
        scene_id: config.scene_id.clone(),
        poses,
    };
    request.validate_poses()?;
    Ok(Some(RetinaBatch { request, rgb }))
}
