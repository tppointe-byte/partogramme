const enPatiente = document.getElementById("en_patiente");
const enGrossesse = document.getElementById("en_grossesse");
const listeEnfants = document.getElementById("liste-enfants");
const messageEnfants = document.getElementById("message-enfants");
const carteEnfant = document.getElementById("carte-formulaire-enfant");
const titreEnfant = document.getElementById("titre-formulaire-enfant");
const formulaireEnfant = document.getElementById("formulaire-enfant");
const messageFormEnfant = document.getElementById("message-formulaire-enfant");
const boutonEnfant = document.getElementById("btn-enregistrer-enfant");
const boutonNouvelEnfant = document.getElementById("btn-nouvel-enfant");

let enfants = [];
let idEnfantEnEdition = null;

async function chargerPageEnfants() {
  await chargerPatientes();
  const choix = Number(enPatiente.value) || null;
  remplirSelect(enPatiente, patientes.map((p) => [p.id_patiente, nomPatiente(p)]), choix);
  await chargerGrossessesEnfants();
}

async function chargerGrossessesEnfants() {
  fermerFormulaireEnfant();
  const choix = Number(enGrossesse.value) || null;
  enGrossesse.replaceChildren();
  listeEnfants.replaceChildren();
  boutonNouvelEnfant.disabled = true;

  const idPatiente = Number(enPatiente.value);
  if (!idPatiente) {
    afficherMessage(messageEnfants, "Choisissez une patiente.");
    return;
  }
  const { data, error } = await db
    .from("grossesse")
    .select("id_grossesse, debut, parite")
    .eq("id_patiente", idPatiente)
    .order("debut", { ascending: false });
  if (error) {
    afficherMessage(messageEnfants, "Impossible de lire les grossesses : " + error.message, "erreur");
    return;
  }
  if (data.length === 0) {
    afficherMessage(messageEnfants, "Cette patiente n'a pas de grossesse enregistrée.");
    return;
  }
  remplirSelect(
    enGrossesse,
    data.map((g) => [g.id_grossesse, `Début ${formaterDate(g.debut)}${g.parite === null ? "" : ` · parité ${g.parite}`}`]),
    choix,
  );
  boutonNouvelEnfant.disabled = false;
  await chargerEnfants();
}

async function chargerEnfants() {
  fermerFormulaireEnfant();
  const idGrossesse = Number(enGrossesse.value);
  if (!idGrossesse) return;

  afficherMessage(messageEnfants, "Chargement…");
  const { data, error } = await db
    .from("enfant")
    .select("*")
    .eq("id_grossesse", idGrossesse)
    .order("date_heure_naissance", { ascending: true });
  if (error) {
    afficherMessage(messageEnfants, "Impossible de lire les enfants : " + error.message, "erreur");
    return;
  }
  enfants = data;
  afficherEnfants();
}

function afficherEnfants() {
  listeEnfants.replaceChildren();
  if (enfants.length === 0) {
    afficherMessage(messageEnfants, "Aucun enfant enregistré pour cette grossesse.");
    return;
  }
  afficherMessage(messageEnfants, `${enfants.length} enfant(s)`);

  for (const e of enfants) {
    const tr = document.createElement("tr");
    tr.append(cellule(e.prenom));

    const tdSexe = document.createElement("td");
    if (e.sexe) {
      tdSexe.append(creerPastille(e.sexe, "orientation"));
    } else {
      tdSexe.textContent = "—";
      tdSexe.className = "vide";
    }
    tr.append(
      tdSexe,
      cellule(e.date_heure_naissance ? formaterDateHeure(e.date_heure_naissance) : ""),
      cellule(e.poids_naissance_kg === null ? "" : `${String(e.poids_naissance_kg).replace(".", ",")} kg`),
      cellule(e.taille_cm === null ? "" : `${e.taille_cm} cm`),
    );

    const tdAction = document.createElement("td");
    tdAction.style.textAlign = "right";
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton icone";
    bouton.textContent = "✎";
    bouton.title = "Modifier cet enfant";
    bouton.setAttribute("aria-label", `Modifier l'enfant ${e.prenom ?? ""}`.trim());
    bouton.addEventListener("click", () => ouvrirFormulaireEnfant(e));
    tdAction.append(bouton);
    tr.append(tdAction);

    listeEnfants.append(tr);
  }
}

function ouvrirFormulaireEnfant(enfant) {
  idEnfantEnEdition = enfant ? enfant.id_enfant : null;
  titreEnfant.textContent = enfant ? `Modifier ${enfant.prenom ?? "l'enfant"}` : "Nouvel enfant";
  document.getElementById("en_prenom").value = enfant?.prenom ?? "";
  document.getElementById("en_sexe").value = enfant?.sexe ?? "";
  document.getElementById("en_naissance").value = enfant?.date_heure_naissance
    ? valeurDatetimeLocal(new Date(enfant.date_heure_naissance))
    : "";
  document.getElementById("en_poids").value = enfant?.poids_naissance_kg ?? "";
  document.getElementById("en_taille").value = enfant?.taille_cm ?? "";
  afficherMessage(messageFormEnfant, "");
  carteEnfant.hidden = false;
  carteEnfant.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("en_prenom").focus();
}

function fermerFormulaireEnfant() {
  carteEnfant.hidden = true;
  idEnfantEnEdition = null;
}

formulaireEnfant.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();

  const prenom = document.getElementById("en_prenom").value.trim();
  const sexe = document.getElementById("en_sexe").value;
  const naissance = document.getElementById("en_naissance").value;
  const valeurs = {
    prenom: prenom === "" ? null : prenom,
    sexe: sexe === "" ? null : sexe,
    date_heure_naissance: naissance === "" ? null : new Date(naissance).toISOString(),
    poids_naissance_kg: nombreOuNull("en_poids"),
    taille_cm: nombreOuNull("en_taille"),
  };

  boutonEnfant.disabled = true;
  afficherMessage(messageFormEnfant, "Enregistrement…");

  const requete = idEnfantEnEdition === null
    ? db.from("enfant").insert({ ...valeurs, id_grossesse: Number(enGrossesse.value) }).select()
    : db.from("enfant").update(valeurs).eq("id_enfant", idEnfantEnEdition).select();
  const { data, error } = await requete;

  boutonEnfant.disabled = false;

  if (error) {
    afficherMessage(messageFormEnfant, "Échec de l'enregistrement : " + error.message, "erreur");
    return;
  }
  if (!data || data.length === 0) {
    afficherMessage(messageFormEnfant, "Rien n'a été enregistré : la base a refusé l'opération (droits d'accès).", "erreur");
    return;
  }

  await chargerEnfants();
});

enPatiente.addEventListener("change", chargerGrossessesEnfants);
enGrossesse.addEventListener("change", chargerEnfants);
boutonNouvelEnfant.addEventListener("click", () => ouvrirFormulaireEnfant(null));
document.getElementById("btn-annuler-enfant").addEventListener("click", fermerFormulaireEnfant);
