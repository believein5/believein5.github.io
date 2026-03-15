---
id: css-animation
title: CSS Animation
type: skill
tags:
  - css
  - animation
  - transform
difficulty: intermediate
aliases:
  - CSS 动画
summary: CSS animation combines keyframes, transforms, and timing functions to create motion in the browser.
retrieval_keywords:
  - css animation
  - @keyframes
  - transform-origin
  - 动画
project_links:
  - ../../HTML-files/Ferris-wheel.html
  - ../../HTML-files/Penguin.html
---

## CSS Animation

## What it is

CSS animation lets you define how visual properties change over time. In practice, it often works best with `transform` and `opacity`.

## Why it matters

- Makes abstract timing concepts visible.
- Helps connect static CSS knowledge to interactive interfaces.
- Provides strong training examples for agents that need to explain animation bugs.

## Common errors

- Using the wrong `transform-origin`.
- Animating `top` and `left` when `transform` would be smoother.
- Forgetting reduced-motion considerations.

## Verification steps

1. Watch at least one full loop and confirm it behaves predictably.
2. Inspect whether the motion depends on layout recalculation.
3. Check whether keyframes match the intended visual narrative.
