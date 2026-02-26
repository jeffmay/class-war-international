# Project: Class War: International

## Project Description
A board game based on the rules in ./docs/rules.pdf using boardgame.io framework with React.

## Code Conventions
- Prettier for formatting
- ESLint for linting
- Functional components with hooks for React
- 2-space indentation
- camelCase for methods and functions
- PascalCase for components, classes, and enums
- snake_case for JSON data

## Common Development Tasks

```
npm run typecheck     # Typecheck all files
npm test              # Run all tests
npm run lint          # Run the linter on all files
```

The app is running at http://localhost:3000, and you can use the Playwright MCP to access it.

## Important Notes
- MUST always run `npm run typecheck`, then `npm test`, and then `npm run lint` for all files before commiting code changes.
- MUST always commit all completed work with a comprehensive git commit message using [gitmoji](https://gitmoji.dev/) where applicable.
- MUST always keep the Project Structure in README.md up-to-date changes to the directory structure or top-level config files and instructions on how to build, test, and deploy the code.
- MUST always write unit tests for all significant game logic changes.
- MUST always write component tests for all view changes.
- MUST never use the `as` keyword to cast a type without validating every field in the type.
- MUST never use the `any` type.
- MUST always use responsive design to ensure that the elements never require horizontal scrolling, while maximizing use of horizontal space for mobile device, tablet, laptop, and wide screens.
- MUST always use CSS over JavaScript for styling elements.
- MUST always use `vw` units unless the element is a horizontal line or when creating a font-size that is relative to a sibling or parent element, in which case, `em` is fine.
