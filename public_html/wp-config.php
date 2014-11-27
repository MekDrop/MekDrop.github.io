<?php
/**
 * The base configurations of the WordPress.
 *
 * This file has the following configurations: MySQL settings, Table Prefix,
 * Secret Keys, WordPress Language, and ABSPATH. You can find more information
 * by visiting {@link http://codex.wordpress.org/Editing_wp-config.php Editing
 * wp-config.php} Codex page. You can get the MySQL settings from your web host.
 *
 * This file is used by the wp-config.php creation script during the
 * installation. You don't have to use the web site, you can just copy this file
 * to "wp-config.php" and fill in the values.
 *
 * @package WordPress
 */

// ** MySQL settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define('DB_NAME', 'mekdrop_name');

/** MySQL database username */
define('DB_USER', 'mekdrop_name');

/** MySQL database password */
define('DB_PASSWORD', 'saUp5dxO');

/** MySQL hostname */
define('DB_HOST', 'localhost');

/** Database Charset to use in creating database tables. */
define('DB_CHARSET', 'utf8');

/** The Database Collate type. Don't change this if in doubt. */
define('DB_COLLATE', '');

define('WP_ALLOW_MULTISITE', true);
define('MULTISITE', true);
define('SUBDOMAIN_INSTALL', true);
define('DOMAIN_CURRENT_SITE', 'blog.mekdrop.name');
define('PATH_CURRENT_SITE', '/');
define('SITE_ID_CURRENT_SITE', 1);
define('BLOG_ID_CURRENT_SITE', 1);
define('COOKIE_DOMAIN', 'mekdrop.name');

/**#@+
 * Authentication Unique Keys and Salts.
 *
 * Change these to different unique phrases!
 * You can generate these using the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}
 * You can change these at any point in time to invalidate all existing cookies. This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define('AUTH_KEY',         'kV?i 2%B0Glj z^^C/zr]9)~>Vg[eD2-K Jl&g0BT!B&wU .4~U70N|+{Rp|Jj+C');
define('SECURE_AUTH_KEY',  ',IVrohXD^N_500bwH}>,>s!N<_t]3`L5cS<m =x=BcOc,rS?,![`h>P/7Eq|:t~=');
define('LOGGED_IN_KEY',    'zjS$nic`i`=^1/u/-@jDrOO8-&e/--6L-Hi~pY<#})Yu|]08f6e{nl>71`s^:.5h');
define('NONCE_KEY',        'E;P6}kl[o;KIT2auy($mglTT2Pd+ =>]pq-eo;Q#+y:3s{Qjp%KXRVBjDD]G/@7F');
define('AUTH_SALT',        'R<J-|8KoY{JY$&oSLMb :!]2qPJeh9mgv:_pp]x||%[tD4^R]C-Od[hfzNW]:$U$');
define('SECURE_AUTH_SALT', '-mU_Y3Nga1KHl5Z&d{y+d5,imHRKi;hO:3wv2-1&(HJAJa=^J2(0+]Ag<0W$)>+$');
define('LOGGED_IN_SALT',   'VgU5[:~8WRY*N8a|rlG.mQ&{7)[T~Q;N&-4w|Mo]-Zh{L1F+`6Exbe, :ThpmVNX');
define('NONCE_SALT',       'y5)7?9qO66k,_90wl?l^3n<P@LG#;s[1aE6)`u[)O^@X3a-q+-*(6XZ;du7>yW_?');

/**#@-*/

/**
 * WordPress Database Table prefix.
 *
 * You can have multiple installations in one database if you give each a unique
 * prefix. Only numbers, letters, and underscores please!
 */
$table_prefix  = 'bmn22_';

/**
 * WordPress Localized Language, defaults to English.
 *
 * Change this to localize WordPress. A corresponding MO file for the chosen
 * language must be installed to wp-content/languages. For example, install
 * de_DE.mo to wp-content/languages and set WPLANG to 'de_DE' to enable German
 * language support.
 */
define ('WPLANG', 'lt_LT');

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 */
define('WP_DEBUG', !Ätrue);
define('WP_DEBUG_LOG', !true);

/* That's all, stop editing! Happy blogging. */

/** Absolute path to the WordPress directory. */
if ( !defined('ABSPATH') )
	define('ABSPATH', dirname(__FILE__) . '/');

/** Sets up WordPress vars and included files. */
require_once(ABSPATH . 'wp-settings.php');

