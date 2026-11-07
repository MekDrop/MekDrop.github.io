uniform vec2 uCloudTravel;
uniform sampler2D uCloudVoxels;
uniform vec2 uCloudCube;
uniform vec4 uUpperCloudBank;
uniform vec4 uLowerCloudBank;
uniform vec2 uLowerCloudSeed;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyBelow;
varying vec3 vSkyDirection;

float hash(vec2 p) {
  vec2 q = mod(floor(p), 251.0);
  float value = mod(q.x * 73.0 + q.y * 151.0 + 19.0, 251.0);
  value = mod(value * value * 13.0 + value * 7.0 + 17.0, 65521.0);
  return mod(value * 53.0 + 113.0, 65521.0) / 65521.0;
}

// Trace solid blocks in sky space, retaining the nearest exposed face.
void blockHit(vec3 ray, float pixelAngle, vec3 center, vec3 size, inout float nearest,
    inout vec3 normal, inout vec3 cubePosition, out float coverage) {
  vec3 inverseRay = 1.0 / (ray + vec3(0.000001));
  // Filter the ray's box silhouette, not creases between two visible faces.
  // MSAA cannot antialias silhouettes generated inside a skybox fragment shader.
  float footprint = max(length(center) * pixelAngle, 0.00001);
  vec3 a = (center - size * 0.5) * inverseRay;
  vec3 b = (center + size * 0.5) * inverseRay;
  vec3 nearFace = min(a, b);
  vec3 farFace = max(a, b);
  float entry = max(max(nearFace.x, nearFace.y), nearFace.z);
  float exit = min(min(farFace.x, farFace.y), farFace.z);
  vec3 midpoint = abs(ray * ((entry + exit) * 0.5) - center) - size * 0.5;
  float margin = -max(max(midpoint.x, midpoint.y), midpoint.z);
  coverage = smoothstep(-footprint, footprint, margin);
  if (entry > 0.0 && coverage > 0.0 && entry < nearest) {
    nearest = entry;
    cubePosition = (ray * entry - center) / size;
    normal = vec3(0.0);
    if (nearFace.x > nearFace.y && nearFace.x > nearFace.z) {
      normal.x = -sign(ray.x);
    } else if (nearFace.y > nearFace.z) {
      normal.y = -sign(ray.y);
    } else {
      normal.z = -sign(ray.z);
    }
  }
}

bool intersectsCloud(vec3 ray, vec3 center, vec3 size) {
  vec3 a = (center - size * 0.5) / (ray + vec3(0.000001));
  vec3 b = (center + size * 0.5) / (ray + vec3(0.000001));
  vec3 nearFace = min(a, b);
  vec3 farFace = max(a, b);
  return max(max(nearFace.x, nearFace.y), nearFace.z)
      < min(min(farFace.x, farFace.y), farFace.z);
}

float faceEdgeDistance(vec3 position, vec3 normal) {
  vec3 axis = abs(normal);
  if (axis.x > axis.y && axis.x > axis.z) {
    return min(0.5 - abs(position.y), 0.5 - abs(position.z));
  }
  if (axis.y > axis.z) {
    return min(0.5 - abs(position.x), 0.5 - abs(position.z));
  }
  return min(0.5 - abs(position.x), 0.5 - abs(position.y));
}

void main(void) {
  vec3 ray = normalize(vSkyDirection);
  // Evaluate derivatives before any divergent cloud / voxel loops.
  float pixelAngle = 0.5 * max(length(dFdx(ray)), length(dFdy(ray)));
  float elevation = abs(ray.y);
  vec3 sky = mix(uSkyHorizon, ray.y >= 0.0 ? uSkyZenith : uSkyBelow,
      smoothstep(0.0, 0.9, elevation));
  // Banks above and beneath the floating islands share one continuous sky.
  // World directions, rather than face UVs, keep every box corner seamless.
  vec4 bank = ray.y < 0.0 ? uLowerCloudBank : uUpperCloudBank;
  float bankY = ray.y < 0.0 ? -bank.x : bank.x;
  vec2 travel = uCloudTravel * 12.0;
  // Search the whole height interval, including crowns and voxel extents.
  // A fixed 3x3 neighborhood at y=30 clips clouds as rays cross cell boundaries.
  vec2 heights = ray.y < 0.0 ? vec2(31.0, 48.0) : vec2(25.5, 39.0);
  vec2 start = ray.xz * (heights.x / max(elevation, 0.001)) - travel;
  vec2 end = ray.xz * (heights.y / max(elevation, 0.001)) - travel;
  vec2 minimumCell = floor((min(start, end) - 12.0) / bank.y);
  vec2 maximumCell = floor((max(start, end) + 12.0) / bank.y);
  vec3 pixelColor = vec3(0.0);
  float pixelAlpha = 0.0;
  float colorWeight = 0.0;
  if (elevation > 0.06) {
    for (int x = 0; x < 12; x++) {
      float cellX = minimumCell.x + float(x);
      if (cellX > maximumCell.x) break;
      for (int z = 0; z < 12; z++) {
        float cellZ = minimumCell.y + float(z);
        if (cellZ > maximumCell.y) break;
        vec2 id = vec2(cellX, cellZ);
        vec2 pattern = id + (ray.y < 0.0 ? uLowerCloudSeed : vec2(0.0));
        if (hash(pattern + 47.0) > bank.w) {
          continue;
        }
        float shape = hash(pattern);
        vec2 center = (id + vec2(0.1 + shape * 0.8,
            0.1 + hash(pattern + 7.0) * 0.8)) * bank.y + travel;
        float height = bankY * (0.94 + hash(pattern + 29.0) * 0.12);
        float layer = floor(hash(pattern + 19.0) * 3.0);
        float scale = (layer < 0.5 ? 0.56 : layer < 1.5 ? 0.78 : 1.0) * bank.z;
        vec3 origin = vec3(center.x, height, center.y);
        if (!intersectsCloud(ray, origin + vec3(0.0, scale, 0.0),
            vec3(11.0, 4.0, 8.0) * scale + vec3(length(origin) * pixelAngle * 2.0))) {
          continue;
        }
        float variant = floor(shape * 20.0);
        float nearest = 10000.0;
        vec3 topColor = layer < 0.5 ? vec3(0.78, 0.89, 0.96)
            : layer < 1.5 ? vec3(0.88, 0.95, 0.99) : vec3(0.96, 0.985, 1.0);
        vec3 sideColor = layer < 0.5 ? vec3(0.55, 0.7, 0.81)
            : layer < 1.5 ? vec3(0.64, 0.78, 0.88) : vec3(0.72, 0.84, 0.92);
        float opacity = layer < 0.5 ? 0.28 : layer < 1.5 ? 0.46 : 0.7;
        vec3 accumulated = vec3(0.0);
        float coverage = 0.0;
        // The original 20 voxel recipes, with their original cube size/spacing.
        for (int voxel = 0; voxel < 20; voxel++) {
          vec4 data = texture2D(uCloudVoxels,
              vec2((float(voxel) + 0.5) / 32.0, (variant + 0.5) / 20.0));
          if (data.a < 0.5) {
            break;
          }
          vec3 offset = (floor(data.xyz * 255.0 + 0.5) - 8.0) * uCloudCube.x;
          offset.xz = vec2(offset.x + offset.z, -offset.x + offset.z) * 0.70710678;
          float voxelNearest = 10000.0;
          vec3 voxelNormal = vec3(0.0);
          vec3 voxelPosition = vec3(0.0);
          float antialias = 0.0;
          blockHit(ray, pixelAngle, origin + offset * scale,
              vec3(uCloudCube.y * scale), voxelNearest, voxelNormal, voxelPosition, antialias);
          if (voxelNearest < 9999.0) {
            // Composite each original translucent cube, including overlaps.
            // A single opaque surface would lose the original airy voxel grid.
            float topFace = smoothstep(0.35, 0.9, voxelNormal.y);
            float lighting = 0.86 + max(dot(voxelNormal,
                normalize(vec3(0.42, 0.82, 0.38))), 0.0) * 0.14;
            vec3 color = mix(sideColor, topColor, topFace) * lighting;
            float edgeDistance = faceEdgeDistance(voxelPosition, voxelNormal);
            float edge = smoothstep(0.0, 0.055, edgeDistance);
            float alpha = opacity * mix(0.86, 1.0, edge) * antialias;
            accumulated = accumulated * (1.0 - alpha) + color * alpha;
            coverage = coverage * (1.0 - alpha) + alpha;
            if (voxelNearest < nearest) {
              nearest = voxelNearest;
            }
          }
        }
        if (coverage > 0.0) {
          // Distant banks merge into the pale horizon instead of filling it
          // with equally sharp, equally bright miniature clouds.
          float haze = 1.0 - exp(-max(nearest - 45.0, 0.0) * 0.008);
          accumulated = mix(accumulated, sky * coverage, haze * 0.45);
          float distanceFade = 1.0 - smoothstep(180.0, 450.0, nearest) * 0.45;
          accumulated *= distanceFade;
          coverage *= distanceFade;
          // Keep every translucent cloud. Selecting only the nearest cloud
          // makes backgrounds disappear abruptly at overlapping silhouettes.
          float weight = 1.0 / max(nearest, 1.0);
          pixelColor += accumulated * weight;
          colorWeight += coverage * weight;
          pixelAlpha = 1.0 - (1.0 - pixelAlpha) * (1.0 - coverage);
        }
      }
    }
  }
  float horizon = smoothstep(0.06, 0.16, elevation);
  vec3 cloudColor = pixelColor / max(colorWeight, 0.00001);
  gl_FragColor = vec4(mix(sky, cloudColor, pixelAlpha * horizon), 1.0);
}
