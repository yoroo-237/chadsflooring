# Shop React App

Clone fidèle de la boutique chadsflooring.bz en React.js.

## Installation

```bash
npm install
npm start
```

## Structure

```
src/
  App.jsx          — composant principal, logique filtre/tri/panier
  App.css          — tous les styles (variables CSS, animations, responsive)
  index.js         — point d'entrée React
  data/
    products.js    — données produits et catégories
  components/
    Header.jsx     — header avec logo, timer livraison, XMR, search, cart, profil
    ProductCard.jsx— carte produit avec hover overlay, wishlist, étoiles
    CartDrawer.jsx — panier latéral
    FilterPanel.jsx— panneau filtre latéral
    StarRating.jsx — composant étoiles (demi-étoiles)
    Footer.jsx     — footer avec liens et sélecteur thème
```

## Fonctionnalités

- ✅ Navigation par catégories (onglets)
- ✅ Filtres (marque, rating, prix, stock)
- ✅ Tri A-Z
- ✅ Toggle "In stock only"
- ✅ Vue grille / liste
- ✅ Panier latéral avec animations
- ✅ Wishlist par produit
- ✅ Quick add au survol
- ✅ Timer compte à rebours livraison
- ✅ Popup tour d'onboarding
- ✅ Toasts de notification
- ✅ Responsive mobile
- ✅ Animations CSS (fadeIn, shimmer)
