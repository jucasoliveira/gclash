# Guild Clash Medieval UI Design System

This document outlines the design system for the Guild Clash game UI, focusing on the medieval-themed components and styling.

## Color Palette

Our color palette is inspired by medieval manuscripts, parchment, and castle aesthetics:

- **Parchment** (`#e8d7b9`): Used for backgrounds, cards, and light elements
- **Parchment Dark** (`#d8c7a9`): Used for hover states and secondary elements
- **Ink** (`#5a3e2a`): Used for text on light backgrounds
- **Blood** (`#8b3a3a`): Used for primary buttons, accents, and important elements
- **Blood Dark** (`#6e2e2e`): Used for hover states on primary buttons
- **Night** (`#1a2e35`): Used for page backgrounds and secondary buttons
- **Night Light** (`#2a3e45`): Used for hover states on secondary buttons

## Typography

- **Headings**: Bold, slightly larger than normal text, using the Blood color on light backgrounds and Parchment on dark backgrounds
- **Body Text**: Regular weight, using Ink color on light backgrounds and Parchment on dark backgrounds
- **Accents**: Italic or semi-bold for emphasis, often in Blood color

## Components

### Layout Components

- **Page** (`.medieval-page`): Full-height container with dark background
- **Header** (`.medieval-header`): Parchment-colored bar with logo and navigation
- **Main** (`.medieval-main`): Content container with maximum width and centered
- **Footer** (`.medieval-footer`): Dark bar with copyright information

### Cards

- **Card** (`.medieval-card`): Parchment-colored container with Blood-colored border
- **Card Header** (`.medieval-card-header`): Gradient background with title
- **Card Title** (`.medieval-card-title`): Bold, Blood-colored text
- **Card Content** (`.medieval-card-content`): Padded container for card content

### Buttons

- **Primary Button** (`.medieval-button`): Blood-colored with Parchment text
- **Secondary Button** (`.medieval-button-secondary`): Night-colored with Parchment text
- **Disabled Button**: Faded appearance with not-allowed cursor

### Selection Components

- **Option** (`.medieval-option`): Light background with Ink text, Blood border
- **Selected Option** (`.medieval-option.selected`): Blood background with Parchment text
- **Option Description** (`.medieval-option-description`): Light background with descriptive text

### Form Elements

- **Input** (`.medieval-input`): Light background with Ink text and Blood border

### Avatar

- **Avatar** (`.medieval-avatar`): Circular container for user initials or image

## Layout Patterns

- **Grid** (`.medieval-grid`): Responsive grid for cards and content
- **Flex** (`.medieval-flex`): Flexible container for aligned content
- **Spacing**: Consistent spacing using the spacing variables

## Special Effects

- **Parchment Texture**: Applied as an overlay to create an aged paper look
- **Gradients**: Used for card headers and backgrounds
- **Shadows**: Applied to cards and buttons for depth
- **Hover Effects**: Color changes and subtle transformations

## Responsive Design

- Mobile-first approach with breakpoints at:
  - 768px: Switches from multi-column to single-column layouts
  - Adjusts padding and spacing for smaller screens

## Usage Examples

### Page Layout

```jsx
<div className="medieval-page">
  <header className="medieval-header">
    <div className="parchment-overlay"></div>
    <div className="medieval-flex medieval-items-center medieval-gap-sm">
      {/* Logo and title */}
    </div>
    <button className="medieval-button">Logout</button>
  </header>

  <main className="medieval-main">
    <div className="medieval-text-center medieval-mb-lg">
      <h1 className="medieval-title">Page Title</h1>
      <p className="medieval-subtitle">Page description</p>
    </div>

    <div className="medieval-grid">{/* Cards and content */}</div>
  </main>

  <footer className="medieval-footer">
    <p>Guild Clash &copy; {new Date().getFullYear()} | All rights reserved</p>
  </footer>
</div>
```

### Card Component

```jsx
<div className="medieval-card">
  <div className="parchment-overlay"></div>

  <div className="medieval-card-header">
    <div className="medieval-card-title">Card Title</div>
    <div className="medieval-card-subtitle">Card subtitle</div>
  </div>

  <div className="medieval-card-content">
    {/* Card content */}

    <button className="medieval-button">Primary Action</button>
  </div>
</div>
```

### Selection Options

```jsx
<div className="medieval-flex-col medieval-gap-md">
  <button
    className={`medieval-option ${selected === "option1" ? "selected" : ""}`}
    onClick={() => setSelected("option1")}
  >
    Option 1
  </button>

  <button
    className={`medieval-option ${selected === "option2" ? "selected" : ""}`}
    onClick={() => setSelected("option2")}
  >
    Option 2
  </button>

  {selected && (
    <div className="medieval-option-description">
      Description for the selected option
    </div>
  )}
</div>
```

## Future Enhancements

- Add animations for transitions between states
- Create more sophisticated card variations
- Implement themed form controls (checkboxes, radio buttons, etc.)
- Add sound effects for UI interactions
- Create a dark mode variation
- Implement accessibility improvements
