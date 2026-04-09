precision highp float;

#define MAX_SOLIDS 64
#define MAX_ENEMIES 40
#define MAX_COINS 40

uniform vec2 uResolution;
uniform vec4 uViewport;
uniform vec2 uWorldSize;
uniform float uTime;
uniform float uPixelScale;
uniform vec4 uPlayerBox;
uniform vec4 uPlayerMotion;
uniform vec4 uPlayerState;
uniform vec4 uGoal;
uniform vec4 uSolids[MAX_SOLIDS];
uniform vec4 uSolidMeta[MAX_SOLIDS];
uniform float uSolidCount;
uniform vec4 uEnemies[MAX_ENEMIES];
uniform vec4 uEnemyMeta[MAX_ENEMIES];
uniform float uEnemyCount;
uniform vec4 uCoins[MAX_COINS];
uniform vec4 uCoinMeta[MAX_COINS];
uniform float uCoinCount;
uniform sampler2D uPalette;
