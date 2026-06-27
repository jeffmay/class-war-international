# Graph Report - class-war-international  (2026-06-26)

## Corpus Check
- 80 files · ~63,105 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 750 nodes · 1320 edges · 53 communities (46 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ff03b0d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Game Engine & State|Core Game Engine & State]]
- [[_COMMUNITY_Game UI Components|Game UI Components]]
- [[_COMMUNITY_Web App Dependencies|Web App Dependencies]]
- [[_COMMUNITY_Lobby & Routing|Lobby & Routing]]
- [[_COMMUNITY_Card Type Definitions|Card Type Definitions]]
- [[_COMMUNITY_Conflict Modal & Effects|Conflict Modal & Effects]]
- [[_COMMUNITY_Conventions & Deployment|Conventions & Deployment]]
- [[_COMMUNITY_Card Generation Script|Card Generation Script]]
- [[_COMMUNITY_Game Mechanics Overview|Game Mechanics Overview]]
- [[_COMMUNITY_Server Dependencies|Server Dependencies]]
- [[_COMMUNITY_TypeScript Config (Web)|TypeScript Config (Web)]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Capitalist Actions & Setup|Capitalist Actions & Setup]]
- [[_COMMUNITY_TypeScript Config (Shared)|TypeScript Config (Shared)]]
- [[_COMMUNITY_Typed boardgame.io Wrappers|Typed boardgame.io Wrappers]]
- [[_COMMUNITY_Money, Tiles & Win Conditions|Money, Tiles & Win Conditions]]
- [[_COMMUNITY_Demands, Legislation & Level 2|Demands, Legislation & Level 2]]
- [[_COMMUNITY_Workers, Strikes & Workplaces|Workers, Strikes & Workplaces]]
- [[_COMMUNITY_Monorepo Root Config|Monorepo Root Config]]
- [[_COMMUNITY_Shared Package Dependencies|Shared Package Dependencies]]
- [[_COMMUNITY_Multiplayer E2E Tests|Multiplayer E2E Tests]]
- [[_COMMUNITY_TypeScript Config (Server)|TypeScript Config (Server)]]
- [[_COMMUNITY_Conflict Resolution Steps|Conflict Resolution Steps]]
- [[_COMMUNITY_Social Power & Dice System|Social Power & Dice System]]
- [[_COMMUNITY_TypeScript Config (Scripts)|TypeScript Config (Scripts)]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Turn Structure & Exhaustion|Turn Structure & Exhaustion]]
- [[_COMMUNITY_Status Text & Error Log|Status Text & Error Log]]
- [[_COMMUNITY_Web App Manifest (PWA)|Web App Manifest (PWA)]]
- [[_COMMUNITY_Rulebook Appendix & Credits|Rulebook Appendix & Credits]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Docs Package Config|Docs Package Config]]
- [[_COMMUNITY_Future Win Conditions|Future Win Conditions]]
- [[_COMMUNITY_Robots.txt Policy|Robots.txt Policy]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]

## God Nodes (most connected - your core abstractions)
1. `SocialClass` - 42 edges
2. `Completed Features` - 26 edges
3. `makeActionPhaseState()` - 20 edges
4. `clientFromFixture()` - 19 edges
5. `compilerOptions` - 18 edges
6. `ConflictType` - 15 edges
7. `compilerOptions` - 15 edges
8. `CardType` - 14 edges
9. `GameState` - 13 edges
10. `playFigureCard()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Action Phase` --semantically_similar_to--> `Action Phase`  [INFERRED] [semantically similar]
  README.md → PROJECT_SUMMARY.md
- `Web App HTML Entry Point` --references--> `Class War: International`  [INFERRED]
  web/index.html → README.md
- `Class War: International` --semantically_similar_to--> `Core Game Engine (boardgame.io)`  [INFERRED] [semantically similar]
  README.md → PROJECT_SUMMARY.md
- `Production Phase` --semantically_similar_to--> `Production Phase`  [INFERRED] [semantically similar]
  README.md → PROJECT_SUMMARY.md
- `Reproduction Phase` --semantically_similar_to--> `Reproduction Phase`  [INFERRED] [semantically similar]
  README.md → PROJECT_SUMMARY.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Turn Structure: Production, Action, Reproduction phases** — docs_original_rulebook_production_phase, docs_original_rulebook_action_phase, docs_original_rulebook_reproduction_phase [EXTRACTED 1.00]
- **Play area: Society, Economy, and The State** — docs_original_rulebook_society, docs_original_rulebook_economy, docs_original_rulebook_state [EXTRACTED 1.00]
- **Social power resolves conflicts: Potential Power, Established Power, Power Dice** — docs_original_rulebook_potential_power, docs_original_rulebook_established_power, docs_original_rulebook_power_dice, docs_original_rulebook_conflict [INFERRED 0.85]
- **CI/CD Deployment Pipeline** — workflows_ci_ci, workflows_test_and_lint_lint_and_test, workflows_ci_deploy_web_preview, workflows_ci_deploy_api_preview, workflows_cd_deploy_main, workflows_pr_delete_preview_delete_preview, do_app_spec [INFERRED 0.85]
- **Three-Phase Turn Cycle** — readme_production_phase, readme_action_phase, readme_reproduction_phase, readme_turn_structure [EXTRACTED 1.00]
- **Conflict Resolution Flow** — project_summary_conflict_system, project_summary_strike_conflict, project_summary_election_conflict, project_summary_legislation_conflict, project_summary_die_mechanics [INFERRED 0.85]
- **Three conflict types: Strikes, Elections, Legislation** — docs_original_rulebook_strike, docs_original_rulebook_election, docs_original_rulebook_legislation_action [EXTRACTED 1.00]
- **Level 2 New Table Elements** — docs_original_rulebook_platform_tile, docs_original_rulebook_institution_tile, docs_original_rulebook_bigger_bank, docs_original_rulebook_third_workplace_tile [EXTRACTED 1.00]
- **State Figures: Centrist, Opportunist, Populist** — docs_original_rulebook_centrist, docs_original_rulebook_opportunist, docs_original_rulebook_populist, docs_original_rulebook_state_figure [EXTRACTED 1.00]

## Communities (53 total, 7 thin omitted)

### Community 0 - "Core Game Engine & State"
Cohesion: 0.10
Nodes (18): createPlayerState(), DIE_FACES, PluginAPIs, setup(), SetupContext, shuffleArray(), triggerFigureActivation(), triggerInstitutionActivation() (+10 more)

### Community 1 - "Game UI Components"
Cohesion: 0.06
Nodes (38): ActionMenuBar(), ActionMenuBarProps, MenuOption, CardBorderVariant, CardComponent(), CardComponentProps, ConflictModalProps, DealResultModal() (+30 more)

### Community 2 - "Web App Dependencies"
Cohesion: 0.05
Nodes (40): dependencies, boardgame.io, lodash, react, react-dom, ts-brand, devDependencies, eslint (+32 more)

### Community 3 - "Lobby & Routing"
Cohesion: 0.05
Nodes (42): App(), findMatchCredentials(), getMatchCredentials(), lobbyHash(), LobbyRouteProps, LobbyStatus, LocalGameManagerProps, LocalGameRouteProps (+34 more)

### Community 4 - "Card Type Definitions"
Cohesion: 0.16
Nodes (18): AnyCard, AnyCardData, AnyCardInPlay, BaseBoardCardData, BaseCard, BaseCardData, BaseDeckCardData, CardInPlay (+10 more)

### Community 5 - "Conflict Modal & Effects"
Cohesion: 0.11
Nodes (19): ConflictModal(), baseElectionConflict, baseProps, baseStrikeConflict, cashierInPlay, cornerStoreTarget, emptyPlayer, nurseInPlay (+11 more)

### Community 6 - "Conventions & Deployment"
Cohesion: 0.29
Nodes (8): class-war-international-host Service, ORIGINS Environment Variable, DigitalOcean App Spec, Development UI, Online Multiplayer Server, Running the App, deploy-api-prod Job, Deploy Main Branch Workflow (CD)

### Community 7 - "Card Generation Script"
Cohesion: 0.10
Nodes (23): buildCardProps(), byClass, CardRow, cards, cardTypeExpr(), defaultCards, defaultStateFigures, defaultWorkplaces (+15 more)

### Community 8 - "Game Mechanics Overview"
Cohesion: 0.17
Nodes (14): Action Phase, Core Game Engine (boardgame.io), Figure Activation Effects, Institution Effects, Production Phase, Reproduction Phase, Theorize Mechanic, Action Phase (+6 more)

### Community 9 - "Server Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, boardgame.io, node-persist, tsx, devDependencies, eslint, @eslint/js, globals (+12 more)

### Community 10 - "TypeScript Config (Web)"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (15): exhaustedWcFigure, inTrainingWcFigure, makeWcLegislationFixture(), readyCcFigure, readyWcFigure, makeStrikeInitiating(), makeStrikeResolving(), makeStrikeResponding() (+7 more)

### Community 12 - "Capitalist Actions & Setup"
Cohesion: 0.18
Nodes (18): Basic Actions, Build a Workplace (Capitalist action), Capitalists (player class), Class (player faction), Class Deck, Class Tile, The Dustbin of History (discard pile), Expand a Workplace (Level 2 Capitalist action) (+10 more)

### Community 13 - "TypeScript Config (Shared)"
Cohesion: 0.12
Nodes (16): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+8 more)

### Community 14 - "Typed boardgame.io Wrappers"
Cohesion: 0.08
Nodes (21): ClassWarGame, extraOrigins, origins, PORT, server, assertDefined(), assertEqual(), AssertionError (+13 more)

### Community 15 - "Money, Tiles & Win Conditions"
Cohesion: 0.17
Nodes (16): The Bank, Bigger Bank ($20 coins, Level 2), Capitalist Tiles, Coins (money), Economy (board area), Game Tiles, How to Win (Victory Conditions), Level 1 (+8 more)

### Community 16 - "Demands, Legislation & Level 2"
Cohesion: 0.19
Nodes (16): Demand card, Example Legislation (Welfare Reform Demand), Institution card, Institution Tile, Jobs Program (Demand card), Law (passed Demand consequence), Legislation (passing Demands into law), Legislation (Level 2 conflict action) (+8 more)

### Community 17 - "Workers, Strikes & Workplaces"
Cohesion: 0.22
Nodes (14): Corner Store (starter Workplace), Example Strike (Cleaning Crew vs Parts Producer), Minimum Wage ($1 floor), Parts Producer (starter Workplace), Profits, Restructure (Tactic), Starter Workplaces (Corner Store and Parts Producer), Strike (Workers conflict) (+6 more)

### Community 18 - "Monorepo Root Config"
Cohesion: 0.14
Nodes (13): name, private, scripts, generate, lint, server, test, test:e2e (+5 more)

### Community 19 - "Shared Package Dependencies"
Cohesion: 0.14
Nodes (13): dependencies, boardgame.io, lodash, ts-brand, devDependencies, @types/lodash, @types/node, typescript (+5 more)

### Community 21 - "TypeScript Config (Server)"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, skipLibCheck, strict, strictFunctionTypes (+3 more)

### Community 22 - "Conflict Resolution Steps"
Cohesion: 0.27
Nodes (11): Candidate (Figure run for office), Chain (Figures/Tactics committed to a conflict), Corporate Lawyer (Figure), Election Resolution (Initiate, React, Roll Dice, Adjust), Example Election (Buff Jezos vs Centrist), Figure card, Motivator (Figure championing a Demand), Figure Special Ability (+3 more)

### Community 23 - "Social Power & Dice System"
Cohesion: 0.29
Nodes (11): The Centrist (neutral State Figure), Dice Maximum per Class (6 Capitalists / 9 Workers), Dice = Social Power, Election (both classes conflict), Established Power, Incumbent (State Figure in office), Potential Power, Power Dice (+3 more)

### Community 24 - "TypeScript Config (Scripts)"
Cohesion: 0.18
Nodes (10): compilerOptions, erasableSyntaxOnly, module, moduleResolution, noEmit, skipLibCheck, strict, target (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.17
Nodes (21): BaseCardInPlay, BaseStateFigureInPlay, ConflictType, DefaultStateFigureCardInPlay, DemandCardInPlay, FigureCardInPlay, InstitutionCardInPlay, StateFigureCardInPlay (+13 more)

### Community 26 - "Turn Structure & Exhaustion"
Cohesion: 0.24
Nodes (10): Action Phase, Activate an Institution (action), Active Figure, Conflict, Conflict Actions, Exhausted Figure, Exhaustion and Defense, Production Phase (+2 more)

### Community 27 - "Status Text & Error Log"
Cohesion: 0.22
Nodes (11): Conflict Leader Row & Leader Switching, Conflict System, Demand Law Effects, Die Mechanics, Election Conflict, Legislation Conflict, Strike Conflict, Tactic Effects (+3 more)

### Community 28 - "Web App Manifest (PWA)"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 29 - "Rulebook Appendix & Credits"
Cohesion: 0.40
Nodes (6): About Jacobin, Appendix, Class War: The Jacobin Board Game, Credits, Further Reading, Game Overview

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (10): Completed Card Effects, Group 1: Demand Law Enforcement, Group 2: Complex Demand Laws, Group 3: Figure Activation Effects, Group 4: Figure Strike Leader Effects, Group 5: Figure Passive Effects, Group 6: Institution Effects, Group 7: Tactic Out-of-Conflict Moves (+2 more)

### Community 31 - "Community 31"
Cohesion: 0.35
Nodes (8): ConflictOutcomeModal(), ConflictOutcomeModalProps, Die(), dieFace(), DieProps, sideToValue(), SocialClass, ConflictOutcome

### Community 32 - "Docs Package Config"
Cohesion: 0.50
Nodes (3): devDependencies, @types/node, type

### Community 33 - "Future Win Conditions"
Cohesion: 0.04
Nodes (44): 10. React UI Foundation, 11. Escape Key Closes ActionMenuBar (`src/Board.tsx`), 12. "Activated Figures" Rename (`src/Board.tsx`), 13. Card Slot Labels and `demands[-1]` / `institutions[-1]` Support, 14. Status Banners on Figure Cards (`src/components/CardComponent.tsx`), 15. Turn Counter and Current Player in Top Bar (`src/Board.tsx`), 16. Redesigned Control Bar (`src/Board.tsx`), 17. Left Sidebar Replaces Opposing Player Area (`src/Board.tsx`) (+36 more)

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (16): advanceToCCActionPhase(), readyCashier, readyCleaningCrew, advanceToCCAction(), clientFromFixture(), makeActionPhaseState(), makeCCActionPhaseClient(), makePlayerState() (+8 more)

### Community 41 - "Community 41"
Cohesion: 0.47
Nodes (6): Web App HTML Entry Point, CI Workflow, deploy-api-preview Job, deploy-web-preview Job, Delete Preview Deploys Workflow, Lint and Test Reusable Workflow

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (6): Code Conventions, Common Development Tasks, graphify, Important Notes, Project: Class War: International, Project Description

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (6): Architecture, File Structure, Lobby System and Persistent Match Storage, Technology Stack, Lobby System, Player ID vs Social Class

### Community 44 - "Community 44"
Cohesion: 0.40
Nodes (5): Flow, How the Lobby Works, Player IDs vs Social Class, Player Name, Rejoining a Match

### Community 45 - "Community 45"
Cohesion: 0.50
Nodes (4): Commands, Development, Project Structure, Testing Philosophy

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (3): Completed, Features, In Progress / Future

## Knowledge Gaps
- **316 isolated node(s):** `$schema`, `plugin`, `@opencode-ai/plugin`, `name`, `version` (+311 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SocialClass` connect `Community 31` to `Core Game Engine & State`, `Game UI Components`, `Card Type Definitions`, `Conflict Modal & Effects`, `Community 40`, `Community 11`, `Typed boardgame.io Wrappers`, `Community 25`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `Class War: International - Project Summary` connect `Future Win Conditions` to `Community 43`, `Community 30`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `Completed Card Effects` connect `Community 30` to `Future Win Conditions`, `Status Text & Error Log`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `plugin`, `@opencode-ai/plugin` to the rest of the system?**
  _316 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Game Engine & State` be split into smaller, more focused modules?**
  _Cohesion score 0.10037878787878787 - nodes in this community are weakly interconnected._
- **Should `Game UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05909090909090909 - nodes in this community are weakly interconnected._
- **Should `Web App Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._