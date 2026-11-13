# BILLETTERIE TRANSPORT — 20 ANS DE HIKMA (LA MAISON DE LA SAGESSE)

## 0. CONTEXTE ET RÈGLES DE TRAVAIL

Plateforme web de réservation et de paiement du transport en bus des participants à la célébration des 20 ans de Hikma (lieu : Dakar Arena, Diamniadio). Les bus partent de trois zones : Pikine, Mbao et Bouguiba. Les participants réservent et paient en ligne (Wave, Orange Money), puis reçoivent un billet PDF avec QR code. La commission Transport pilote tout depuis un espace d'administration. Interface 100 % en français ; code, variables et commits en anglais.

Le dépôt contient un prototype frontend généré par un outil no-code (Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui). Il n'a AUCUN backend : toutes les données sont dans le localStorage, le paiement est simulé, l'accès admin est un code en dur. On garde l'interface et la structure, on remplace tout le reste.

Règles de travail :
- Travaille par phases (section 6). À la fin de chaque phase : résume ce qui a été fait, liste les fichiers modifiés, donne les commandes pour tester, puis ARRÊTE-TOI et attends mon « OK ».
- Avant de rendre la main : `typecheck`, `lint`, `build` et les tests doivent passer. Aucun `any` injustifié, aucun `// @ts-ignore`.
- N'invente jamais l'API d'un tiers (Wave, Orange Money). Si tu n'as pas la documentation officielle, écris l'interface et un `TODO` explicite, et demande-moi.
- Si une règle métier est ambiguë, pose la question au lieu de deviner.
- Le développement se fait sous Windows 11 : aucune commande ni aucun script spécifique à Unix.
- Garde le stack simple : n'ajoute pas de bibliothèque qui n'est pas listée sans me la justifier.

## 1. STRUCTURE DU DÉPÔT

hikma-billetterie/
├── frontend/   (le projet actuel, déplacé ici)
├── backend/    (à créer)
├── docs/SPEC.md
├── .gitignore
└── README.md   (installation, variables d'environnement, lancement, déploiement)

Un seul gestionnaire de paquets : npm. Supprime `bun.lock` et la ligne `packageManager` de bun.

## 2. DÉCISIONS MÉTIER (déjà tranchées)

1. **Zones.** Il y a trois zones de départ (Pikine, Mbao, Bouguiba), gérées dans une table et modifiables par la commission. Chaque bus et chaque point de ramassage appartient à UNE zone.
2. **Bus fixes.** Le nombre de bus de chaque zone est FIXÉ par la commission, ainsi que la capacité de chaque bus (par exemple 40 places pour un Ndiaga Ndiaye, 50 pour un bus). Le système ne crée JAMAIS de bus automatiquement. Seule la commission en ajoute ou en retire.
3. **La capacité vient des bus, pas d'un objectif de personnes.** Aucun nombre de participants attendu n'existe dans le système. Les ventes d'une zone s'arrêtent quand ses bus sont pleins. Aucun nombre de bus ni aucune capacité n'est codé en dur : tout se règle en admin.
4. **Choix de la zone.** Le participant choisit d'abord sa zone, puis un point de ramassage de cette zone. Une réservation n'est jamais affectée à un bus d'une autre zone.
5. **Remplissage par zone, groupe jamais séparé.** Le remplissage séquentiel s'applique PAR ZONE : trois files indépendantes. Une réservation tient entièrement dans UN seul bus : elle est affectée au premier bus ouvert de sa zone (par ordre de numéro) qui a assez de places. Si aucun ne convient, la réservation est refusée sans rien créer :
   - code `NO_BUS_AVAILABLE`, avec `zoneId` et `maxAvailable` (plus grand nombre de places libres dans un même bus de cette zone) ;
   - message : « Il ne reste que N place(s) dans un même bus à <zone>. Réduisez le nombre de places ou contactez la commission. », ou « Les bus de <zone> sont complets. » si `maxAvailable` vaut 0 ;
   - quand d'autres zones ont encore des places, le message le dit (« Il reste des places à Mbao et à Bouguiba. ») et le participant peut changer de zone en un clic, en rechoisissant un point de ramassage.
6. **Statut « complet » dérivé.** Un bus est « complet » quand ses places restantes valent 0, mais ce statut n'est jamais stocké. Seuls « ouvert » et « fermé » sont stockés (fermé = décision manuelle de la commission). Le bus « actif » d'une zone est son premier bus ouvert qui a des places.
7. **Places restantes d'un bus** = capacité − somme des places des réservations PAID ou PENDING non expirées (`expiresAt > now()`).
8. **Blocage temporaire.** Une réservation PENDING bloque ses places pendant `lockMinutes` (réglable, 15 par défaut, à aligner sur la durée de la session de paiement du fournisseur). Passé ce délai, elle est ignorée dans le calcul des places et passe à EXPIRED (nettoyage à l'accès, et facultativement par une tâche périodique légère).
9. **Moyens de paiement.** Le parcours public propose uniquement Wave et Orange Money. « Espèces » n'existe que comme action admin « Marquer payé (espèces) ».
10. **Anti-doublon.** Un même numéro de téléphone ne peut pas avoir deux réservations actives (PENDING non expirée ou PAID) sans confirmation explicite. L'API répond 409 `DUPLICATE_RESERVATION` avec la réservation existante, et le client peut renvoyer `acknowledgeDuplicate: true`.
11. **Montants.** Entiers en FCFA (XOF), recalculés par le serveur à partir des réglages. Ne fais jamais confiance au montant envoyé par le client. Les prix de départ (3000 aller-retour, 2000 aller simple) sont fictifs : tout est modifiable en admin.
12. **Téléphone.** Accepter « 77 123 45 67 », « 771234567 », « +221771234567 » et « 00221... ». Stocker 9 chiffres, validés par `^(70|75|76|77|78)\d{7}$`.
13. **Dates.** Aucune date d'événement en dur : elle vient des réglages.

## 3. BACKEND

### 3.1 Stack
Node.js 20+ (LTS), TypeScript strict, Express, Prisma (dernière version stable, suis sa documentation), PostgreSQL hébergé (via `DATABASE_URL`), Zod (validation de toute entrée), bcrypt, jsonwebtoken, helmet, cors, express-rate-limit, pino, pdfkit, qrcode, exceljs, vitest + supertest. Scripts : dev, build, start, typecheck, lint, test, db:migrate, db:seed.

### 3.2 Modèle de données (Prisma)
- **Zone** : id, name, displayOrder, isActive.
- **Bus** : id, zoneId (obligatoire), number (entier, unique PAR ZONE : contrainte zoneId + number, sert au tri), label (affiché « Pikine · Bus 7 »), capacity (propre à chaque bus), isOpen (bool), departureTime, arrivalTime (heure prévue à Dakar Arena), returnTime, returnLocation.
- **PickupPoint** : id, zoneId (obligatoire), name, isActive.
- **Reservation** : id, reference (unique, ex. `HIKMA-20A-K7P3QX`, générée par le serveur avec `crypto`, alphabet sans caractères ambigus 0/O/1/I), publicToken (unique, aléatoire 128 bits, pour le lien de billet partageable), firstName, lastName, phone, neighborhood (facultatif), zoneId, pickupPointId, seats, tripType (ROUND_TRIP | ONE_WAY), busId (toujours un bus de zoneId), amountXof, paymentMethod (WAVE | ORANGE_MONEY | CASH), status (PENDING | PAID | EXPIRED | CANCELLED), expiresAt, paidAt, checkedInAt, refundRequired (bool), createdAt, updatedAt.
- **Payment** : id, reservationId, provider, providerRef (unique par fournisseur), status (INITIATED | SUCCEEDED | FAILED), amountXof, rawPayload (Json), createdAt.
- **WebhookEvent** : provider, eventId (contrainte d'unicité provider + eventId, pour l'idempotence), receivedAt.
- **Settings** (ligne unique) : eventName, eventDate, venue, priceRoundTripXof, priceOneWayXof, lockMinutes, maxSeatsPerOrder (6), whatsappContact.
- **AdminUser** : id, username (unique), passwordHash, createdAt.
- **AuditLog** : id, adminId, action, targetType, targetId, details (Json), createdAt. Journalise chaque action manuelle (annulation, déplacement, marquage payé, changement de capacité, ouverture ou fermeture de bus, création ou suppression de bus).

Index : reservation(phone), reservation(status, expiresAt), reservation(busId, status), reservation(zoneId).

### 3.3 Réservation : concurrence
`createReservation` s'exécute dans UNE transaction Prisma :
1. Verrouille les bus ouverts de la zone choisie, et seulement ceux-là, dans l'ordre de leur numéro, avec `SELECT ... FOR UPDATE` en SQL brut (même ordre partout, pour éviter les deadlocks). Les autres zones ne sont pas bloquées.
2. Calcule les places restantes de chaque bus (règle 7).
3. Choisit le premier bus qui convient (règle 5) ou renvoie `NO_BUS_AVAILABLE`.
4. Vérifie le doublon de téléphone (règle 10) et que le point de ramassage appartient bien à la zone.
5. Crée la réservation PENDING avec `expiresAt = now + lockMinutes`.

Test obligatoire : 100 requêtes simultanées pour 10 places restantes dans une zone donnent exactement 10 places vendues, jamais plus, et n'affectent pas les autres zones.

### 3.4 Paiement
Interface `PaymentProvider` : `createSession(reservation)`, `verifyWebhook(rawBody, headers)`, `parseEvent(body)`, `getStatus(providerRef)`. Trois implémentations :
- `MockProvider` : pour le développement, avec une fausse page de paiement servie par le frontend (boutons « Paiement réussi » / « Paiement échoué ») ; la route `POST /api/dev/mock-pay` est désactivée si `PAYMENT_MODE=live`.
- `WaveProvider` : intégration réelle de Wave Checkout, selon la documentation officielle uniquement.
- `OrangeMoneyProvider` : squelette qui renvoie `NOT_CONFIGURED` tant que je n'ai pas fourni la documentation et les accès.

Choix par `PAYMENT_MODE=mock|live`. Les clés vivent UNIQUEMENT dans `backend/.env`.

Règles absolues :
- Une réservation passe à PAID uniquement à la réception d'un webhook dont la signature est vérifiée (HMAC sur le corps BRUT : `express.raw()` sur ces routes, pas `express.json()`), ou après vérification serveur du statut. JAMAIS à cause d'une redirection du navigateur.
- Idempotence : un webhook reçu deux fois ne produit aucun doublon (contrainte d'unicité sur WebhookEvent). Ces fournisseurs ne garantissent pas l'idempotence à la création d'une session : ta propre référence unique et un traitement idempotent sont donc indispensables.
- Vérifie que le montant et la devise du webhook correspondent à la réservation.
- Paiement tardif : si un paiement réussi arrive pour une réservation EXPIRED, tente dans une transaction de reprendre les places dans le même bus. Si c'est possible, la réservation devient PAID. Sinon, elle reste EXPIRED avec `refundRequired = true`, et l'admin la voit dans une liste « Paiements à rembourser ».

### 3.5 API
Format d'erreur unique : `{ "error": { "code": "...", "message": "message en français" } }`, avec des codes HTTP corrects. Tout est validé par Zod.

Public :
- `GET /api/public/config` : infos de l'événement, prix, et par zone : points de ramassage, places restantes totales, indicateur « complet ». Ne renvoie PAS la liste détaillée des bus au public.
- `POST /api/reservations` : crée la réservation (3.3).
- `POST /api/reservations/:id/pay` : crée la session de paiement et renvoie l'URL de redirection.
- `GET /api/reservations/lookup?reference=&phone=` : retrouver une réservation (référence ET téléphone exigés).
- `GET /api/reservations/:reference/status` : statut, pour le suivi après paiement.
- `GET /api/tickets/:publicToken.pdf` : billet PDF (4.5).
- `POST /api/webhooks/wave`, `POST /api/webhooks/orange-money`.

Admin (JWT) :
- `POST /api/admin/login`, `GET /api/admin/me`.
- `GET /api/admin/stats` : global et par zone (inscrits, payés, en attente, places restantes, bus remplis / total).
- Zones : liste, création, modification.
- Bus : liste filtrable par zone, création, modification (capacité, horaires, ouvert / fermé), suppression impossible s'il a des réservations actives. Création en masse : `POST /api/admin/buses/bulk` avec `{ zoneId, count, capacity, departureTime, arrivalTime, returnTime, returnLocation }`, qui crée N bus numérotés à la suite des existants de la zone.
- Réservations : liste avec filtres (zone, bus, statut, moyen de paiement, point de ramassage), recherche par nom, téléphone ou référence, pagination côté serveur.
- Actions : annuler ; déplacer vers un autre bus (même zone par défaut ; une autre zone est possible mais exige une confirmation explicite et une vérification du point de ramassage) ; marquer payé (espèces) ; check-in (`POST /api/admin/checkin`).
- Réglages et points de ramassage : CRUD.
- Exports : `GET /api/admin/export/passengers.xlsx` (une feuille par ZONE avec une colonne Bus, plus une feuille récapitulative) et `GET /api/admin/export/passengers.pdf` (une ou plusieurs pages par bus, intitulées « Zone · Bus N »).
- Liste des paiements à rembourser.

### 3.6 Sécurité
- Aucun identifiant en dur. Premier compte admin créé par `db:seed` à partir de `ADMIN_USERNAME` et `ADMIN_PASSWORD` (variables d'environnement). Hash bcrypt.
- JWT à durée limitée (12 h), secret en variable d'environnement, envoyé dans l'en-tête `Authorization: Bearer`.
- Limitation de débit : login (strict), création de réservation et recherche de réservation.
- helmet, CORS limité à `FRONTEND_URL`, taille de corps limitée.
- `.env` jamais commité ; fournir `.env.example` pour le backend et le frontend.
- Aucun numéro de téléphone ni aucun payload de paiement dans les logs.
- Endpoint `/api/health`.

## 4. FRONTEND

### 4.1 Nettoyage
- Corrige le script `dev` pour Windows : `vite --host 0.0.0.0 --port 3000` (sans `PORT=`).
- Supprime : `dala-internal-*`, `vite.config-default.ts`, le README du modèle, `public/gebeya.webp`, les composants inutilisés (`components/animata/*`, `ui/teleprompter.tsx`, tous les composants shadcn non utilisés) et les dépendances non utilisées (supabase, recharts, etc.). Vérifie avec le build.
- Renomme le projet (`hikma-billetterie-frontend`).
- Supprime `bookingStorage.ts` et le localStorage comme source de données. Remplace-le par un client d'API typé (`src/lib/api.ts`) et des hooks TanStack Query.
- Supprime `BRAND.adminCode` et tout affichage d'un code de démonstration.
- Conserve en stockage local uniquement : le jeton admin (sessionStorage) et la dernière réservation du participant, pour l'affichage du billet hors connexion.

### 4.2 Architecture
- Routage réel avec react-router (URL et bouton « retour » du téléphone fonctionnels) : `/`, `/reserver`, `/paiement/:reference` (suivi), `/billet`, `/billet/:publicToken`, `/admin` et sous-pages. Le retour de paiement du fournisseur doit atterrir sur `/paiement/:reference`.
- Formulaires : React Hook Form + Zod. Types TypeScript alignés sur l'API.
- Chaque requête a un état de chargement (skeleton), un état d'erreur avec bouton « Réessayer », et un état vide quand c'est pertinent.

### 4.3 Identité visuelle (charte à respecter strictement)
Couleurs : Vert Sagesse #0B6B3A (dominante), Vert Élément #1E9A52, Orange Dynamique #F57C00, Or Anniversaire #D4AF37, Crème #FFF9EE (fond). Secondaires : Vert Forêt #064D32, Vert Sauge #A7C9A8, Orange Pastel #FFA45C, Sable #EADCC8, Anthracite #2E2E2E (texte). Dégradé vert vers orange pour les bannières.
Polices : Playfair Display (titres, gras italique), Montserrat (textes), chiffre « 20 ANS » en Playfair gras, en or. Charge-les en local avec `@fontsource` (pas de CDN). Slogan : « ... l'Éducation Autrement ! ». Accroche : « 20 ans d'engagement pour une jeunesse éclairée ». Motifs : plume, courbe dynamique, étoile à quatre branches, utilisés avec parcimonie.
Le logo officiel sera placé dans `frontend/public/logo.*` ; en attendant, utilise un logo textuel. Définis les couleurs comme variables CSS et tokens Tailwind (plus aucune couleur par défaut de shadcn visible).

### 4.4 UX/UI (exigence principale : le résultat doit être irréprochable)
Mobile d'abord. Les participants utilisent surtout des Android d'entrée de gamme avec une connexion variable.
- Zones tactiles d'au moins 44 px, boutons larges, `inputMode="tel"` pour le téléphone, `autocomplete` adaptés, bon clavier pour chaque champ.
- Réservation guidée : première étape, le choix de la zone avec trois grandes cartes tactiles (places restantes ou « Complet ») ; puis le point de ramassage de cette zone ; puis le reste (nom, prénom, téléphone, nombre de places, type de trajet). Récapitulatif du prix toujours visible (barre fixe en bas sur mobile), champ téléphone qui se formate et se valide en direct, erreurs en français juste sous le champ.
- Disponibilité honnête : message clair quand un groupe ne rentre pas, ou quand une zone est complète (règle 5), avec le changement de zone en un clic.
- Après l'envoi : décompte visible du temps de blocage des places.
- Retour de paiement : écran « Vérification de votre paiement… » avec interrogation régulière du statut (le webhook peut arriver après la redirection), puis trois issues claires : payé (billet), échec (bouton « Réessayer »), en attente prolongée (message rassurant, référence à conserver, contact de la commission).
- Billet à l'écran : lisible en plein soleil, QR code net et grand, boutons « Télécharger le PDF » et « Envoyer sur WhatsApp » (lien `wa.me` avec le lien du billet). Le billet reste affichable hors connexion (dernière réservation en cache local). Il affiche « Zone · Bus N ».
- Accessibilité : contraste conforme WCAG AA, libellés associés aux champs, focus visible, statuts jamais signalés par la couleur seule (icône + texte). ATTENTION : le blanc sur l'orange #F57C00 ne fait qu'environ 2,7:1 (insuffisant pour du texte courant). Utilise du texte foncé sur l'orange, ou un orange plus foncé pour les fonds de boutons à texte blanc, ou du texte gras de grande taille.
- Animations sobres (framer-motion limité aux transitions utiles), respect de `prefers-reduced-motion`.
- Performance : découpage du code par route (lazy loading), images optimisées, pas de dépendance lourde inutile.

### 4.5 Billet PDF (généré par le serveur)
Format A5, aux couleurs de la charte (bandeau vert, filets or, plume en décor). Contenu : nom et prénom, numéro de réservation, zone et numéro du bus, nombre de places, point de ramassage, heure de départ, heure prévue d'arrivée à Dakar Arena, heure et lieu de retour (si aller-retour), vrai QR code contenant la référence. Polices intégrées au PDF.

### 4.6 Espace commission
Desktop d'abord, mais utilisable sur téléphone (la commission contrôlera l'embarquement le jour J, souvent sur mobile).
- Connexion propre (identifiant + mot de passe), session expirée gérée avec un message.
- Tableau de bord : une ligne de synthèse par zone (inscrits, payés, en attente, places restantes, bus remplis / total), un total général, les montants encaissés par Wave, Orange Money et espèces, actualisation automatique toutes les 20 secondes.
- Bus : le parc peut compter plusieurs dizaines de bus, donc pas de cartes en vrac. Onglets ou filtre par zone, tableau compact (bus, capacité, occupé, barre de remplissage, statut), recherche, actions groupées (ouvrir ou fermer plusieurs bus). Outil de création en masse avec aperçu avant validation (zone, nombre de bus, capacité, horaires).
- Réservations : tableau avec filtres, recherche, pagination serveur, badges de statut (couleur + texte), détail dans un panneau latéral.
- Actions destructrices (annuler, déplacer, changer la capacité, fermer un bus) : boîte de confirmation claire ; chaque action est journalisée.
- Gestion des zones, des points de ramassage et des réglages.
- Exports PDF et Excel (un bouton bien visible), PDF par bus utilisable par le responsable du bus.
- Mode contrôle d'embarquement : scan du QR code avec la caméra (une bibliothèque de scan, à me justifier) ET saisie manuelle de la référence. Retour plein écran très lisible : vert « Bienvenue Prénom — Zone · Bus N », rouge avec la raison (annulé, impayé, déjà validé), vibration facultative. Si le participant monte dans un autre bus que le sien, alerte non bloquante : la commission décide. Prévoir en secours l'export PDF de la liste des passagers, car le réseau à Dakar Arena peut être mauvais.

## 5. TESTS ET QUALITÉ
Tests obligatoires (vitest) : concurrence sur les places d'une zone ; remplissage indépendant par zone ; un groupe jamais séparé et jamais affecté à une autre zone ; `NO_BUS_AVAILABLE` avec proposition des autres zones ; création en masse avec numérotation continue ; expiration des réservations ; doublon de téléphone ; webhook rejoué (idempotence) ; webhook avec mauvaise signature ; montant différent ; paiement tardif ; calcul des places avec des réservations expirées. Le build du frontend et celui du backend doivent passer sans erreur ni avertissement TypeScript.
Données de démonstration (`db:seed`, uniquement si `NODE_ENV=development`) : 3 zones, 3 bus de démonstration par zone, quelques points de ramassage par zone, réglages de démo, un compte admin. Aucune donnée fictive en production.
README complet : installation, variables d'environnement, lancement local, lancement en mode `mock`, déploiement (frontend sur Vercel, backend sur Render, base PostgreSQL hébergée).

## 6. PHASES (arrête-toi après chacune)
1. Mise en place : restructuration du dépôt, nettoyage du frontend, correction du script Windows, `npm install`, build OK, squelette du backend (Express, TypeScript, Prisma, `/api/health`), `.env.example`, README.
2. Base de données et logique de réservation : schéma avec zones, migration, seed de démonstration, service de réservation (transaction, verrou par zone, expiration), tests.
3. API publique, authentification admin, API admin (dont la création de bus en masse).
4. Paiement : interface, MockProvider, Wave, squelette Orange Money, webhooks, paiement tardif, tests.
5. Billet PDF, QR code et exports PDF / Excel.
6. Frontend : client d'API, routage, parcours public complet (choix de la zone, réservation, paiement mock, suivi, billet).
7. Frontend admin : dashboard par zone, bus et création en masse, réservations, réglages, exports, contrôle d'embarquement avec scan.
8. Finition : passe UX/UI complète (mobile, accessibilité, performance), tests de bout en bout, documentation de déploiement.