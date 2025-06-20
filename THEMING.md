# ViralVision Theming System

This document explains how to use the CSS variable-based theming system in ViralVision.

## Overview

ViralVision uses CSS custom properties (variables) for consistent theming across the application. The primary brand color is currently set to a deep red (#780000) with carefully crafted shades for different use cases.

## CSS Variables

### Primary Brand Colors

The following CSS variables control the primary brand colors:

```css
--primary-brand: 0 100% 24%;        /* #780000 - Main brand color */
--primary-brand-hover: 0 100% 20%;  /* #660000 - Darker for hover */
--primary-brand-light: 0 100% 95%;  /* #FFF5F5 - Very light red */
--primary-brand-dark: 0 100% 15%;   /* #4D0000 - Darker red */
```

### Color Format

Colors are defined using HSL (Hue, Saturation, Lightness) format:
- **Hue**: 0-360 degrees (0 = red, 120 = green, 240 = blue)
- **Saturation**: 0-100% (0% = grayscale, 100% = full color)
- **Lightness**: 0-100% (0% = black, 100% = white)

## Utility Classes

### Background Colors
- `.bg-primary-brand` - Main brand background (#780000)
- `.bg-primary-brand-hover` - Hover state background (#660000)
- `.bg-primary-brand-light` - Light variant background (#FFF5F5)
- `.bg-primary-brand-dark` - Dark variant background (#4D0000)

### Text Colors
- `.text-primary-brand` - Main brand text color (#780000)
- `.text-primary-brand-hover` - Hover state text color (#660000)
- `.text-primary-brand-light` - Light variant text color (#FFF5F5)
- `.text-primary-brand-dark` - Dark variant text color (#4D0000)

### Border Colors
- `.border-primary-brand` - Brand border color (#780000)
- `.ring-primary-brand` - Brand ring/focus color (#780000)

### Gradients
- `.bg-gradient-primary` - Linear gradient from brand to hover
- `.bg-gradient-primary-radial` - Radial gradient from brand to hover
- `.bg-gradient-primary-to-transparent` - Gradient from brand to transparent

## How to Change Colors

### Method 1: Modify CSS Variables

To change the entire theme, update the CSS variables in `app/globals.css`:

```css
:root {
  /* Change to blue theme */
  --primary-brand: 210 100% 50%;        /* Blue */
  --primary-brand-hover: 210 100% 40%;  /* Darker blue */
  --primary-brand-light: 210 100% 90%;  /* Light blue */
  --primary-brand-dark: 210 100% 30%;   /* Dark blue */
}

.dark {
  /* Dark mode variants */
  --primary-brand: 210 100% 45%;        /* Slightly darker blue */
  --primary-brand-hover: 210 100% 35%;  /* Darker blue for dark mode */
  --primary-brand-light: 210 100% 85%;  /* Lighter blue for dark mode */
  --primary-brand-dark: 210 100% 25%;   /* Darker blue for dark mode */
}
```

### Method 2: Create Theme Presets

You can create multiple theme presets by adding CSS classes:

```css
.theme-blue {
  --primary-brand: 210 100% 50%;
  --primary-brand-hover: 210 100% 40%;
  --primary-brand-light: 210 100% 90%;
  --primary-brand-dark: 210 100% 30%;
}

.theme-green {
  --primary-brand: 120 100% 50%;
  --primary-brand-hover: 120 100% 40%;
  --primary-brand-light: 120 100% 90%;
  --primary-brand-dark: 120 100% 30%;
}

.theme-purple {
  --primary-brand: 270 100% 50%;
  --primary-brand-hover: 270 100% 40%;
  --primary-brand-light: 270 100% 90%;
  --primary-brand-dark: 270 100% 30%;
}
```

## Usage Examples

### Buttons
```jsx
<Button className="bg-primary-brand hover:bg-primary-brand-hover">
  Click me
</Button>
```

### Text
```jsx
<h1 className="text-primary-brand">Brand Title</h1>
<p className="text-primary-brand-light">Light text</p>
```

### Icons
```jsx
<div className="bg-primary-brand-light">
  <CheckCircle className="text-primary-brand" />
</div>
```

### Gradients
```jsx
<div className="bg-gradient-primary">
  Gradient background
</div>
```

## Current Theme

The current theme uses a deep red color scheme based on #780000:
- **Main**: Deep red (#780000) - HSL: 0, 100%, 24%
- **Hover**: Darker red (#660000) - HSL: 0, 100%, 20%
- **Light**: Very light red (#FFF5F5) - HSL: 0, 100%, 95%
- **Dark**: Darker red (#4D0000) - HSL: 0, 100%, 15%

### Dark Mode Variants
- **Main**: Slightly lighter red (#990000) - HSL: 0, 100%, 30%
- **Hover**: Darker red (#800000) - HSL: 0, 100%, 25%
- **Light**: Light red (#FFE6E6) - HSL: 0, 100%, 90%
- **Dark**: Dark red (#660000) - HSL: 0, 100%, 20%

## Benefits

1. **Consistency**: All brand colors are centralized
2. **Easy Changes**: Modify one variable to change the entire theme
3. **Dark Mode Support**: Automatic dark mode variants
4. **Gradient Support**: Built-in gradient utilities
5. **Type Safety**: CSS variables work with all modern browsers
6. **Performance**: No JavaScript required for theming

## Migration from Hardcoded Colors

All hardcoded `teal-600`, `teal-700`, etc. classes have been replaced with the new CSS variable-based classes. This makes the codebase more maintainable and allows for easy theme changes. 