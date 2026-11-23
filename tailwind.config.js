// Theme tokens imported from the existing portal pages. Conflicting values use scoped CSS variables.
module.exports = {
  "darkMode": "class",
  "content": [
    "./designs/**/*.{html,js,php}",
    "./assets/*.js",
    "./index.php"
  ],
  "theme": {
    "extend": {
      "colors": {
        "on-primary-fixed-variant": "#00504a",
        "outline-variant": "#bdc9c6",
        "tertiary": "rgb(var(--al-colors-tertiary) / <alpha-value>)",
        "surface-container": "rgb(var(--al-colors-surface-container) / <alpha-value>)",
        "on-tertiary-fixed": "rgb(var(--al-colors-on-tertiary-fixed) / <alpha-value>)",
        "tertiary-container": "rgb(var(--al-colors-tertiary-container) / <alpha-value>)",
        "primary-fixed": "#9cf2e8",
        "secondary-fixed": "rgb(var(--al-colors-secondary-fixed) / <alpha-value>)",
        "on-secondary-fixed": "rgb(var(--al-colors-on-secondary-fixed) / <alpha-value>)",
        "surface-container-lowest": "#ffffff",
        "secondary": "rgb(var(--al-colors-secondary) / <alpha-value>)",
        "on-surface-variant": "#3e4947",
        "on-tertiary-container": "rgb(var(--al-colors-on-tertiary-container) / <alpha-value>)",
        "on-primary-fixed": "#00201d",
        "on-error": "#ffffff",
        "primary-container": "#0f766e",
        "secondary-container": "rgb(var(--al-colors-secondary-container) / <alpha-value>)",
        "background": "rgb(var(--al-colors-background) / <alpha-value>)",
        "surface-variant": "rgb(var(--al-colors-surface-variant) / <alpha-value>)",
        "on-background": "rgb(var(--al-colors-on-background) / <alpha-value>)",
        "surface-tint": "#006a63",
        "primary": "#005c55",
        "error": "#ba1a1a",
        "inverse-primary": "#80d5cb",
        "primary-fixed-dim": "#80d5cb",
        "on-tertiary-fixed-variant": "rgb(var(--al-colors-on-tertiary-fixed-variant) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--al-colors-surface-container-highest) / <alpha-value>)",
        "secondary-fixed-dim": "rgb(var(--al-colors-secondary-fixed-dim) / <alpha-value>)",
        "error-container": "#ffdad6",
        "surface-container-low": "rgb(var(--al-colors-surface-container-low) / <alpha-value>)",
        "on-error-container": "#93000a",
        "on-primary": "#ffffff",
        "outline": "#6e7977",
        "inverse-surface": "rgb(var(--al-colors-inverse-surface) / <alpha-value>)",
        "on-secondary-fixed-variant": "rgb(var(--al-colors-on-secondary-fixed-variant) / <alpha-value>)",
        "surface": "rgb(var(--al-colors-surface) / <alpha-value>)",
        "on-tertiary": "#ffffff",
        "surface-container-high": "rgb(var(--al-colors-surface-container-high) / <alpha-value>)",
        "on-primary-container": "#a3faef",
        "on-secondary": "#ffffff",
        "tertiary-fixed-dim": "rgb(var(--al-colors-tertiary-fixed-dim) / <alpha-value>)",
        "surface-bright": "rgb(var(--al-colors-surface-bright) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--al-colors-inverse-on-surface) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--al-colors-on-secondary-container) / <alpha-value>)",
        "tertiary-fixed": "rgb(var(--al-colors-tertiary-fixed) / <alpha-value>)",
        "on-surface": "rgb(var(--al-colors-on-surface) / <alpha-value>)",
        "surface-dim": "rgb(var(--al-colors-surface-dim) / <alpha-value>)"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "margin": "var(--al-spacing-margin)",
        "space-lg": "1.5rem",
        "gutter": "var(--al-spacing-gutter)",
        "space-xl": "2rem",
        "margin-mobile": "1rem",
        "space-2xl": "3rem",
        "gutter-mobile": "1rem"
      },
      "fontFamily": {
        "headline-md": [
          "Inter"
        ],
        "body-sm": [
          "Inter"
        ],
        "label-caps": [
          "Inter"
        ],
        "body-lg": [
          "Inter"
        ],
        "headline-sm": [
          "Inter"
        ],
        "body-md": [
          "Inter"
        ],
        "label-md": [
          "Inter"
        ],
        "title-md": [
          "Inter"
        ],
        "label-lg": [
          "Inter"
        ],
        "headline-lg": [
          "Inter"
        ],
        "code-sm": [
          "Inter"
        ],
        "label-sm": [
          "Inter"
        ],
        "headline-lg-mobile": [
          "Inter"
        ],
        "display": [
          "Inter"
        ]
      },
      "fontSize": {
        "headline-md": [
          "24px",
          {
            "lineHeight": "32px",
            "letterSpacing": "-0.015em",
            "fontWeight": "600"
          }
        ],
        "body-sm": [
          "var(--al-font-body-sm-size)",
          {
            "lineHeight": "var(--al-font-body-sm-lineHeight)",
            "letterSpacing": "var(--al-font-body-sm-letterSpacing)",
            "fontWeight": "var(--al-font-body-sm-fontWeight)"
          }
        ],
        "label-caps": [
          "11px",
          {
            "lineHeight": "16px",
            "letterSpacing": "0.06em",
            "fontWeight": "700"
          }
        ],
        "body-lg": [
          "var(--al-font-body-lg-size)",
          {
            "lineHeight": "var(--al-font-body-lg-lineHeight)",
            "letterSpacing": "var(--al-font-body-lg-letterSpacing)",
            "fontWeight": "var(--al-font-body-lg-fontWeight)"
          }
        ],
        "headline-sm": [
          "20px",
          {
            "lineHeight": "28px",
            "letterSpacing": "-0.01em",
            "fontWeight": "600"
          }
        ],
        "body-md": [
          "var(--al-font-body-md-size)",
          {
            "lineHeight": "var(--al-font-body-md-lineHeight)",
            "letterSpacing": "var(--al-font-body-md-letterSpacing)",
            "fontWeight": "var(--al-font-body-md-fontWeight)"
          }
        ],
        "label-md": [
          "var(--al-font-label-md-size)",
          {
            "lineHeight": "var(--al-font-label-md-lineHeight)",
            "letterSpacing": "var(--al-font-label-md-letterSpacing)",
            "fontWeight": "var(--al-font-label-md-fontWeight)"
          }
        ],
        "title-md": [
          "var(--al-font-title-md-size)",
          {
            "lineHeight": "var(--al-font-title-md-lineHeight)",
            "letterSpacing": "var(--al-font-title-md-letterSpacing)",
            "fontWeight": "var(--al-font-title-md-fontWeight)"
          }
        ],
        "label-lg": [
          "14px",
          {
            "lineHeight": "20px",
            "letterSpacing": "0.01em",
            "fontWeight": "600"
          }
        ],
        "headline-lg": [
          "30px",
          {
            "lineHeight": "38px",
            "letterSpacing": "-0.02em",
            "fontWeight": "700"
          }
        ],
        "code-sm": [
          "12px",
          {
            "lineHeight": "16px",
            "fontWeight": "500"
          }
        ],
        "label-sm": [
          "11px",
          {
            "lineHeight": "14px",
            "letterSpacing": "0.04em",
            "fontWeight": "700"
          }
        ],
        "headline-lg-mobile": [
          "24px",
          {
            "lineHeight": "32px",
            "letterSpacing": "-0.02em",
            "fontWeight": "700"
          }
        ],
        "display": [
          "36px",
          {
            "lineHeight": "44px",
            "letterSpacing": "-0.025em",
            "fontWeight": "700"
          }
        ]
      }
    }
  }
};
