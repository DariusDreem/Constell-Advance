# Constellation

Suivi de progression personnel présenté comme une constellation : toi au centre, une branche par
domaine (créatif, sportif, financier…), une étoile par palier. Une étoile se débloque quand ses
prérequis sont atteints, comme dans un arbre de compétences.

## Lancer le site

```bash
npm install
npm run dev
```

Puis ouvre http://localhost:3000. Sans configuration, le site affiche un **ciel de démonstration** :
tout fonctionne, mais rien n'est enregistré.

## Activer les comptes (Supabase)

1. Crée un projet sur https://supabase.com (offre gratuite).
2. Dans le projet, ouvre **SQL Editor**, colle le contenu de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) et exécute-le.
3. Copie `.env.example` vers `.env.local` et renseigne l'URL du projet et sa clé publique
   (**Project Settings → API**).
4. Dans **Authentication → URL Configuration**, ajoute `http://localhost:3000/auth/callback`
   aux URL de redirection.
5. Relance `npm run dev`.

## Commandes

| Commande            | Rôle                                      |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Serveur de développement                  |
| `npm run build`     | Compilation de production                 |
| `npm run lint`      | ESLint                                    |
| `npm run typecheck` | Vérification des types TypeScript         |
| `npm test`          | Tests du placement et des états (Vitest)  |

## Organisation du code

- `lib/constellation/layout.ts` : placement des étoiles. Fonction pure et déterministe : les mêmes
  données donnent toujours le même ciel.
- `lib/constellation/status.ts` : états (atteinte, accessible, verrouillée), progression chiffrée,
  détection des boucles de prérequis.
- `components/constellation/` : rendu SVG, fiche d'une étoile, formulaire.
- `components/sidebar/` : panneau latéral, bouton trou noir ↔ étoile, domaines, compte.
- `lib/actions/` : Server Actions (enregistrement dans Supabase, règles revérifiées côté serveur).
- `proxy.ts` : rafraîchit la session Supabase à chaque requête (le « middleware » de Next.js 16).

## Règles de placement

- Chaque domaine occupe un secteur ; le premier pointe vers le haut, les autres suivent dans le
  sens horaire. L'ordre se change en faisant glisser les domaines dans le panneau.
- Une étoile est placée plus loin du centre que ses prérequis.
- Une étoile liée à deux domaines **voisins** se place sur leur frontière.
- Si les deux domaines ne sont **pas voisins**, l'étoile reste dans sa branche et un fil courbe en
  pointillés, qui passe par l'extérieur, la relie à son prérequis de l'autre branche.
