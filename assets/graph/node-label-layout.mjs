const DEFAULT_MAX_WIDTH = 160;
const DEFAULT_MAX_LINES = 1;
const DEFAULT_ELLIPSIS = "...";

export function layoutNodeLabel(value, options = {}) {
  const maxWidth = Number(options.maxWidth || DEFAULT_MAX_WIDTH);
  const maxLines = Math.max(1, Number(options.maxLines || DEFAULT_MAX_LINES));
  const ellipsis = options.ellipsis || DEFAULT_ELLIPSIS;
  const text = String(value || "").trim();

  if (!text) {
    return {
      lines: [{ text: "", estimatedWidth: 0 }],
      truncated: false
    };
  }

  const wrappedLines = wrapLabelText(text, maxWidth);
  const truncated = wrappedLines.length > maxLines;
  const visibleLines = wrappedLines.slice(0, maxLines);

  if (truncated) {
    visibleLines[visibleLines.length - 1] = truncateLine(
      visibleLines[visibleLines.length - 1],
      maxWidth,
      ellipsis
    );
  }

  return {
    lines: visibleLines.map((line) => ({
      text: line,
      estimatedWidth: estimateTextWidth(line)
    })),
    truncated
  };
}

export function estimateTextWidth(value) {
  return Array.from(String(value || "")).reduce(
    (width, character) => width + estimateGlyphWidth(character),
    0
  );
}

function wrapLabelText(text, maxWidth) {
  const units = splitLabelUnits(text);
  const lines = [];
  let currentLine = "";

  for (const unit of units) {
    const nextLine = `${currentLine}${unit}`;
    if (!currentLine || estimateTextWidth(nextLine) <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine.trim());
    currentLine = unit.trimStart();

    while (estimateTextWidth(currentLine) > maxWidth) {
      const chunk = takeFittingPrefix(currentLine, maxWidth, "");
      lines.push(chunk);
      currentLine = currentLine.slice(chunk.length);
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines.filter(Boolean);
}

function splitLabelUnits(text) {
  const units = [];
  let asciiBuffer = "";

  for (const character of Array.from(text)) {
    if (isAsciiWordCharacter(character)) {
      asciiBuffer += character;
      continue;
    }

    if (asciiBuffer) {
      units.push(asciiBuffer);
      asciiBuffer = "";
    }

    units.push(character);
  }

  if (asciiBuffer) {
    units.push(asciiBuffer);
  }

  return units;
}

function truncateLine(line, maxWidth, ellipsis) {
  if (estimateTextWidth(line) + estimateTextWidth(ellipsis) <= maxWidth) {
    return `${line}${ellipsis}`;
  }

  return `${takeFittingPrefix(line, maxWidth, ellipsis)}${ellipsis}`;
}

function takeFittingPrefix(text, maxWidth, suffix) {
  const suffixWidth = estimateTextWidth(suffix);
  let result = "";

  for (const character of Array.from(text)) {
    const next = `${result}${character}`;
    if (estimateTextWidth(next) + suffixWidth > maxWidth) {
      break;
    }
    result = next;
  }

  return result.trimEnd();
}

function estimateGlyphWidth(character) {
  if (/\s/u.test(character)) {
    return 4;
  }

  if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/u.test(character)) {
    return 14;
  }

  if (/[A-Z0-9]/u.test(character)) {
    return 8;
  }

  if (/[a-z]/u.test(character)) {
    return 7;
  }

  if (/[.,:;'"`!|/\\()[\]{}_-]/u.test(character)) {
    return 5;
  }

  return 12;
}

function isAsciiWordCharacter(character) {
  return /[a-z0-9_-]/i.test(character);
}
