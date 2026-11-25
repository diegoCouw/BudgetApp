# Skill: update-docs

Houd alle documentatiebestanden en contextbestanden up-to-date bij elke relevante wijziging.

## Wanneer toepassen

Pas deze regels toe bij **elke wijziging** aan het project, ongeacht of dit een bugfix, nieuwe feature of refactor is.

## Bestanden die bijgewerkt moeten worden

| Bestand | Bijwerken wanneer |
|---|---|
| `CLAUDE.md` | Bij elke nieuwe feature, endpoint, breaking change, todo-wijziging, of architectuurwijziging |
| `README.md` | Bij nieuwe endpoints, versie-bumps, nieuwe installatiestappen, of gewijzigde URLs |
| `docs/01-setup.md` | Bij gewijzigde setup-stappen, nieuwe secrets, of nieuwe vereisten |
| `docs/02-azure.md` | Bij Azure-configuratiewijzigingen, nieuwe secrets, of deployment-aanpassingen |
| `docs/03-neon.md` | Bij nieuwe database-tabellen, schema-wijzigingen, of Neon-configuratiewijzigingen |
| `docs/04-enable-banking.md` | Bij Enable Banking-configuratiewijzigingen of overschakeling naar productie |
| `docs/05-pwa-architectuur.md` | Bij nieuwe views, functies in bank.js, versie-bumps, of nieuwe scripts |
| `docs/06-backend-architectuur.md` | Bij nieuwe endpoints, services, of configuratiewijzigingen |
| `docs/07-fe-architectuur.md` | Bij Angular-ontwikkeling (toekomstig) |
| `docs/08-applicatie-werking.md` | Bij wijzigingen in stromen, beveiliging, of foutscenario's |

## Regels

1. **Endpoints**: voeg altijd nieuwe endpoints toe aan de tabellen in `CLAUDE.md`, `README.md` en `docs/06-backend-architectuur.md`.

2. **Versie-bumps**: update `docs/05-pwa-architectuur.md` (versienummer in tekst) en `CLAUDE.md` bij elke versie-bump van de PWA.

3. **Todo-lijst**: de todo-lijst in `CLAUDE.md` moet altijd overeenkomen met de werkelijke status van het project. Verplaats afgeronde items naar de "Afgerond"-sectie.

4. **Secrets**: als er een nieuw Azure secret nodig is, voeg het toe aan:
   - `docs/01-setup.md` (stap 5: Azure secrets)
   - `docs/02-azure.md` (Secrets-tabel)
   - `docs/06-backend-architectuur.md` (Configuratiesleutels-tabel)
   - `CLAUDE.md` (Secrets-sectie)

5. **Nieuwe functies in bank.js**: voeg toe aan de functie-tabel in `docs/05-pwa-architectuur.md` en update `docs/08-applicatie-werking.md` als de stroom verandert.

6. **Bekende beperkingen**: als een probleem wordt opgelost, verplaats het van "bekende beperkingen" naar "geschiedenis van opgeloste problemen" in `CLAUDE.md`.

## Hoe updaten

Docs bijwerken maakt altijd deel uit van de feature-branch en zit in **dezelfde commit of PR** als de code-wijziging. Docs zijn geen apart PR, tenzij het puur documentatiewerk is.

Minimale update: één zin toevoegen of bijwerken die beschrijft wat er veranderd is.
