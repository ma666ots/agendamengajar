import fs from 'fs';
import path from 'path';

const filesToPatch = [
  'node_modules/html2canvas/dist/html2canvas.esm.js',
  'node_modules/html2canvas/dist/html2canvas.js',
];

const oklchFunctionCode = `
var oklch = function (_context, args) {
    var tokens = args.filter(nonFunctionArgSeparator);
    var l = tokens[0] ? (tokens[0].type === 16 ? tokens[0].number / 100 : tokens[0].number) : 0;
    var c = tokens[1] ? tokens[1].number : 0;
    var h = tokens[2] ? tokens[2].number : 0;
    var a = tokens[3] ? (tokens[3].type === 16 ? tokens[3].number / 100 : tokens[3].number) : 1;
    var hRad = (h * Math.PI) / 180;
    var a_ = c * Math.cos(hRad);
    var b_ = c * Math.sin(hRad);
    var l_ = l + 0.3963377774 * a_ + 0.2158037573 * b_;
    var m_ = l - 0.1055613458 * a_ - 0.0638541728 * b_;
    var s_ = l - 0.0894841775 * a_ - 1.2914855480 * b_;
    var L = l_ * l_ * l_;
    var M = m_ * m_ * m_;
    var S = s_ * s_ * s_;
    var r = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
    var g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
    var b = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;
    var toSrgb = function(val) {
        val = Math.max(0, Math.min(1, val));
        return val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    };
    return pack(Math.round(toSrgb(r) * 255), Math.round(toSrgb(g) * 255), Math.round(toSrgb(b) * 255), a);
};
`;

filesToPatch.forEach(filePath => {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, 'utf8');

  // 1. Prevent throwing on unknown color functions (fallback to 0 / transparent)
  content = content.replace(
    /throw new Error\("Attempting to parse an unsupported color function \\"" \+ value\.name \+ "\\""\);/g,
    'return 0;'
  );

  // 2. Add oklch to SUPPORTED_COLOR_FUNCTIONS if not already added
  if (!content.includes('oklch: oklch')) {
    content = content.replace(
      /var SUPPORTED_COLOR_FUNCTIONS = \{/g,
      `${oklchFunctionCode}\nvar SUPPORTED_COLOR_FUNCTIONS = {\n    oklch: oklch,`
    );
  }

  // 3. Fix font baseline measurement offset caused by Tailwind preflight (img display: block)
  content = content.replace(
    /img\.style\.verticalAlign = 'baseline';/g,
    "img.style.verticalAlign = 'baseline'; img.style.display = 'inline'; span.style.display = 'inline';"
  );

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Patched ${filePath} successfully.`);
});
