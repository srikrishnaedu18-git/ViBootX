/**
 * ViBootX - VTOP Neural Network CAPTCHA Solver
 * Lightweight single-layer neural network running client-side.
 * Decodes 6-character uppercase alphanumeric CAPTCHAs in < 10ms.
 */

(function (root) {
  "use strict";

  const LABEL_TXT = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const WIDTH = 200;
  const HEIGHT = 40;

  function getModel() {
    if (typeof root.VTOP_NN_MODEL !== "undefined") {
      return root.VTOP_NN_MODEL;
    }
    if (typeof VTOP_NN_MODEL !== "undefined") {
      return VTOP_NN_MODEL;
    }
    console.error("ViBootX: VTOP_NN_MODEL is not loaded!");
    return null;
  }

  /**
   * Convert RGBA pixel array from 200x40 canvas into saturation values
   * and segment into 6 character blocks.
   */
  function saturation(rgbaData) {
    const saturate = new Float32Array(rgbaData.length / 4);
    for (let i = 0; i < rgbaData.length; i += 4) {
      const r = rgbaData[i];
      const g = rgbaData[i + 1];
      const b = rgbaData[i + 2];
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      saturate[i / 4] = max === 0 ? 0 : Math.round(((max - min) * 255) / max);
    }

    const img = [];
    for (let i = 0; i < HEIGHT; i++) {
      const row = [];
      for (let j = 0; j < WIDTH; j++) {
        row.push(saturate[i * WIDTH + j]);
      }
      img.push(row);
    }

    const blocks = [];
    for (let i = 0; i < 6; i++) {
      const x1 = (i + 1) * 25 + 2;
      const y1 = 7 + 5 * (i % 2) + 1;
      const x2 = (i + 2) * 25 + 1;
      const y2 = 35 - 5 * ((i + 1) % 2);
      const block = [];
      for (let y = y1; y < y2; y++) {
        block.push(img[y].slice(x1, x2));
      }
      blocks.push(block);
    }
    return blocks;
  }

  /**
   * Threshold a character block to 0/1 based on mean pixel value and flatten.
   */
  function preImgAndFlatten(block) {
    let sum = 0;
    let count = 0;
    for (let r = 0; r < block.length; r++) {
      for (let c = 0; c < block[r].length; c++) {
        sum += block[r][c];
        count++;
      }
    }
    const avg = sum / (count || 1);
    const flat = new Float32Array(count);
    let idx = 0;
    for (let r = 0; r < block.length; r++) {
      for (let c = 0; c < block[r].length; c++) {
        flat[idx++] = block[r][c] > avg ? 1 : 0;
      }
    }
    return flat;
  }

  /**
   * Predict single character block using NN weights and biases.
   */
  function predictBlock(flat, weights, biases) {
    const numClasses = biases.length;
    let maxLogit = -Infinity;
    let bestIdx = 0;

    for (let c = 0; c < numClasses; c++) {
      let logit = biases[c];
      for (let i = 0; i < flat.length; i++) {
        if (flat[i] === 1) {
          logit += weights[i][c];
        }
      }
      if (logit > maxLogit) {
        maxLogit = logit;
        bestIdx = c;
      }
    }
    return LABEL_TXT[bestIdx] || "";
  }

  /**
   * Core solver: takes ImageData object (200x40).
   */
  function solveFromImageData(imageData) {
    const model = getModel();
    if (!model) throw new Error("ViBootX: NN model missing");

    const blocks = saturation(imageData.data);
    let result = "";
    for (let b = 0; b < 6; b++) {
      const flat = preImgAndFlatten(blocks[b]);
      result += predictBlock(flat, model.weights, model.biases);
    }
    return result;
  }

  /**
   * Solve directly from an <img> DOM element or data URL.
   */
  function solveFromImage(imgElementOrSrc) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const processImg = (img) => {
          ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
          const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
          const text = solveFromImageData(imageData);
          resolve(text);
        };

        if (typeof imgElementOrSrc === "string") {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => processImg(img);
          img.onerror = (e) => reject(new Error("Failed to load image from src"));
          img.src = imgElementOrSrc;
        } else if (imgElementOrSrc instanceof HTMLImageElement) {
          if (imgElementOrSrc.complete && imgElementOrSrc.naturalWidth > 0) {
            processImg(imgElementOrSrc);
          } else {
            imgElementOrSrc.onload = () => processImg(imgElementOrSrc);
            imgElementOrSrc.onerror = (e) => reject(new Error("Image element failed to load"));
          }
        } else {
          reject(new Error("Invalid image source provided to solver"));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  const VTOPCaptchaSolver = {
    solveFromImageData,
    solveFromImage,
    LABEL_TXT,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = VTOPCaptchaSolver;
  } else {
    root.VTOPCaptchaSolver = VTOPCaptchaSolver;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
