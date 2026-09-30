const listePraticiens = document.getElementById("liste-praticiens");
const messagePraticiens = document.getElementById("message-praticiens");
const cartePraticien = document.getElementById("carte-formulaire-praticien");
const titrePraticien = document.getElementById("titre-formulaire-praticien");
const formulairePraticien = document.getElementById("formulaire-praticien");
const messageFormPraticien = document.getElementById("message-formulaire-praticien");
const boutonPraticien = document.getElementById("btn-enregistrer-praticien");
const prSpecialite = document.getElementById("pr_specialite");

let idPraticienEnEdition = null;

for (const { specialite } of ROLES) prSpecialite.append(new Option(specialite, specialite));

async function chargerPagePraticiens() {
  fermerFormulairePraticien();
  afficherMessage(messagePraticiens, "Chargement…");
  if (!(await chargerPraticiens())) {
    afficherMessage(messagePraticiens, "Impossible de lire les praticiens.", "erreur");
    return;
  }
  afficherPraticiens();
}

function afficherPraticiens() {
  listePraticiens.replaceChildren();
  if (praticiens.length === 0) {
    afficherMessage(messagePraticiens, "Aucun praticien pour l'instant.");
    return;
  }
  afficherMessage(messagePraticiens, `${praticiens.length} praticien(s)`);

  for (const p of praticiens) {
    const tr = document.createElement("tr");
    tr.append(cellule(p.nom), cellule(p.prenom));

    const tdSpecialite = document.createElement("td");
    if (p.specialite) {
      tdSpecialite.append(creerPastille(p.specialite, "orientation"));
    } else {
      tdSpecialite.textContent = "—";
      tdSpecialite.className = "vide";
    }
    tr.append(tdSpecialite);

    const tdAction = document.createElement("td");
    tdAction.style.textAlign = "right";
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton icone";
    bouton.textContent = "✎";
    bouton.title = "Modifier ce praticien";
    bouton.setAttribute("aria-label", `Modifier ${p.prenom ?? ""} ${p.nom ?? ""}`.trim());
    bouton.addEventListener("click", () => ouvrirFormulairePraticien(p));
    tdAction.append(bouton);
    tr.append(tdAction);

    listePraticiens.append(tr);
  }
}

function ouvrirFormulairePraticien(praticien) {
  idPraticienEnEdition = praticien ? praticien.id_praticien : null;
  titrePraticien.textContent = praticien
    ? `Modifier ${praticien.prenom ?? ""} ${praticien.nom ?? ""}`.trim()
    : "Nouveau praticien";
  document.getElementById("pr_nom").value = praticien?.nom ?? "";
  document.getElementById("pr_prenom").value = praticien?.prenom ?? "";
  prSpecialite.value = praticien?.specialite ?? ROLES[0].specialite;
  afficherMessage(messageFormPraticien, "");
  cartePraticien.hidden = false;
  cartePraticien.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("pr_nom").focus();
}

function fermerFormulairePraticien() {
  cartePraticien.hidden = true;
  idPraticienEnEdition = null;
}

formulairePraticien.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();

  const valeurs = {
    nom: document.getElementById("pr_nom").value.trim(),
    prenom: document.getElementById("pr_prenom").value.trim(),
    specialite: prSpecialite.value,
  };

  boutonPraticien.disabled = true;
  afficherMessage(messageFormPraticien, "Enregistrement…");

  const requete = idPraticienEnEdition === null
    ? db.from("praticien").insert(valeurs).select()
    : db.from("praticien").update(valeurs).eq("id_praticien", idPraticienEnEdition).select();
  const { data, error } = await requete;

  boutonPraticien.disabled = false;

  if (error) {
    afficherMessage(messageFormPraticien, "Échec de l'enregistrement : " + error.message, "erreur");
    return;
  }
  if (!data || data.length === 0) {
    afficherMessage(messageFormPraticien, "Rien n'a été enregistré : la base a refusé l'opération (droits d'accès).", "erreur");
    return;
  }

  await chargerPagePraticiens();
});

document.getElementById("btn-nouveau-praticien").addEventListener("click", () => ouvrirFormulairePraticien(null));
document.getElementById("btn-annuler-praticien").addEventListener("click", fermerFormulairePraticien);
