/**
 * Logo file: repo `images/logo.png` (served as `/images/logo.png`).
 * After replacing the file with the same name, increment LOGO_VERSION so
 * browsers fetch the new image (and keep `public/index.html` favicon query in sync).
 */
const LOGO_VERSION = "2";

export const brandLogoUrl = `${process.env.PUBLIC_URL || ""}/images/logo.png?v=${LOGO_VERSION}`;
