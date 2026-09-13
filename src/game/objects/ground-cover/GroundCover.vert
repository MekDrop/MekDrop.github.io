attribute vec3 vertex_position;
attribute vec3 vertex_normal;
attribute vec4 vertex_color;
attribute vec4 instance_line1;
attribute vec4 instance_line2;
attribute vec4 instance_line3;
attribute vec4 instance_line4;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;
uniform vec3 uHeroPosition;
uniform vec2 uHeroDirection;
uniform float uHeroInfluence;
uniform float uBendHeight;
uniform float uBloomHeight;
uniform float uBloomSinkDepth;
uniform float uBloomTiltAngle;
uniform float uFlexibility;
uniform float uTrampleAngle;
uniform float uAmbientMotion;

varying vec3 vWorldNormal;
varying vec4 vVertexColor;
varying float vTipHeight;

vec3 rotateAroundAxis(vec3 vector, vec3 axis, float angle) {
  float cosine = cos(angle);
  float sine = sin(angle);
  return vector * cosine + cross(axis, vector) * sine +
      axis * dot(axis, vector) * (1.0 - cosine);
}

void main(void) {
  mat4 instanceMatrix = mat4(
      instance_line1,
      instance_line2,
      instance_line3,
      instance_line4
  );
  vec3 instanceOrigin = instanceMatrix[3].xyz;
  vec3 instanceOffset = mat3(instanceMatrix) * vertex_position;
  float heightAboveGround = max(instanceOffset.y, 0.0);
  float tipHeight = smoothstep(0.015, uBendHeight, heightAboveGround);
  float flexibleTip = tipHeight * tipHeight * uFlexibility;

  vec2 windDirection = normalize(vec2(0.82, 0.48));
  float broadWind = sin(
      uTime * 1.45 + instanceOrigin.x * 0.72 + instanceOrigin.z * 0.51
  );
  float fineWind = sin(
      uTime * 2.35 - instanceOrigin.x * 1.17 + instanceOrigin.z * 0.83
  );
  vec2 windOffset =
      windDirection *
      (broadWind * 0.09 + fineWind * 0.04) *
      uBendHeight *
      flexibleTip *
      uAmbientMotion;

  vec2 heroOffset = instanceOrigin.xz - uHeroPosition.xz;
  float heroDistance = length(heroOffset);
  vec2 heroForward = normalize(uHeroDirection);
  vec2 heroRight = vec2(heroForward.y, -heroForward.x);
  vec2 feetCenter = uHeroPosition.xz + heroForward * 0.1;
  vec2 footOffset = instanceOrigin.xz - feetCenter;
  float alongFeet = dot(footOffset, heroForward);
  float acrossFeet = dot(footOffset, heroRight);
  float leftFootDistance = length(
      vec2((acrossFeet + 0.13) / 0.34, alongFeet / 0.42)
  );
  float rightFootDistance = length(
      vec2((acrossFeet - 0.13) / 0.34, alongFeet / 0.42)
  );
  float nearestFootDistance = min(leftFootDistance, rightFootDistance);
  vec2 leftFootCenter = feetCenter - heroRight * 0.13;
  vec2 rightFootCenter = feetCenter + heroRight * 0.13;
  vec2 nearestFootCenter =
      length(leftFootCenter - instanceOrigin.xz) <=
          length(rightFootCenter - instanceOrigin.xz)
        ? leftFootCenter
        : rightFootCenter;
  vec2 targetFootOffset = nearestFootCenter - instanceOrigin.xz;
  float sameLevel = 1.0 - smoothstep(
      0.58,
      0.9,
      abs(instanceOrigin.y - uHeroPosition.y)
  );
  float contactFalloff =
      (1.0 - smoothstep(1.0, 1.12, nearestFootDistance)) * sameLevel;
  // Lower the flower before moving it sideways. This keeps the blossom from
  // briefly drawing over the boot while it enters the contact boundary.
  float verticalContact = sqrt(contactFalloff);
  float horizontalContact = contactFalloff * contactFalloff;
  float motionFalloff =
      (1.0 - smoothstep(0.16, 1.12, heroDistance)) *
      sameLevel *
      uHeroInfluence;
  vec2 awayFromHero =
      heroDistance > 0.001 ? heroOffset / heroDistance : -uHeroDirection;
  vec2 heroPushDirection = normalize(
      awayFromHero + uHeroDirection * (0.24 + motionFalloff * 0.12)
  );
  vec3 bloomPivot =
      mat3(instanceMatrix) * vec3(0.0, uBloomHeight, 0.0);
  float heightRatio = clamp(
      heightAboveGround / max(bloomPivot.y, 0.001),
      0.0,
      1.0
  );
  float bendProgress =
      heightRatio * heightRatio * (3.0 - 2.0 * heightRatio);
  float trampleAngle = radians(uTrampleAngle);
  float targetDistance = length(targetFootOffset);
  float maximumBendReach = bloomPivot.y * sin(trampleAngle);
  vec2 bentTipOffset =
      targetFootOffset *
      min(1.0, maximumBendReach / max(targetDistance, 0.001));
  vec2 bendDirection =
      length(bentTipOffset) > 0.001
        ? normalize(bentTipOffset)
        : heroForward;
  vec3 bendAxis = vec3(bendDirection.y, 0.0, -bendDirection.x);
  vec3 curvedStemOffset = instanceOffset;
  curvedStemOffset.xz +=
      bentTipOffset * bendProgress * horizontalContact;
  curvedStemOffset.y = mix(
      instanceOffset.y,
      instanceOffset.y * cos(trampleAngle * heightRatio),
      verticalContact
  );
  vec3 pressedBloomPivot = vec3(
      bentTipOffset.x * horizontalContact,
      mix(
          bloomPivot.y,
          bloomPivot.y * cos(trampleAngle) - uBloomSinkDepth,
          verticalContact
      ),
      bentTipOffset.y * horizontalContact
  );
  float bloomTiltAngle = radians(uBloomTiltAngle);
  vec3 pressedBloomOffset =
      pressedBloomPivot +
      rotateAroundAxis(
          instanceOffset - bloomPivot,
          bendAxis,
          bloomTiltAngle * horizontalContact
      );
  float greenPart = step(
      max(vertex_color.r, vertex_color.b) + 0.08,
      vertex_color.g
  );
  float bloomPart = 1.0 - greenPart;
  instanceOffset = mix(
      instanceOffset,
      curvedStemOffset,
      greenPart
  );
  instanceOffset = mix(
      instanceOffset,
      pressedBloomOffset,
      bloomPart
  );
  vec3 localPosition = instanceOffset + instanceOrigin;
  vec2 heroOffsetAmount =
      heroPushDirection * motionFalloff * flexibleTip * uBendHeight * 0.95;

  localPosition.xz +=
      (windOffset + heroOffsetAmount) * (1.0 - verticalContact);

  vec4 worldPosition = matrix_model * vec4(localPosition, 1.0);
  vec3 localNormal = normalize(mat3(instanceMatrix) * vertex_normal);
  vec3 bentStemNormal = rotateAroundAxis(
      localNormal,
      bendAxis,
      trampleAngle * heightRatio * horizontalContact
  );
  vec3 tiltedBloomNormal = rotateAroundAxis(
      localNormal,
      bendAxis,
      bloomTiltAngle * horizontalContact
  );
  vec3 contactedNormal = mix(
      tiltedBloomNormal,
      bentStemNormal,
      greenPart
  );
  localNormal = normalize(contactedNormal);
  vWorldNormal = normalize(
      mat3(matrix_model) * localNormal
  );
  vVertexColor = vertex_color;
  vTipHeight = tipHeight;
  gl_Position = matrix_viewProjection * worldPosition;
}
