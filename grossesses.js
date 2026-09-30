const ROLES = [
  { champ: "id_sage_femme", specialite: "Sage-femme" },
  { champ: "id_obstetricien", specialite: "Obstétricien" },
  { champ: "id_anesthesiste", specialite: "Anesthésiste" },
  { champ: "id_pediatre", specialite: "Pédiatre" },
];

const choixPatiente = document.getElementById("choix-patiente");
const listeGrossesses = document.getElementById("liste-grossesses");
const messageGrossesses = document.getElementById("message-grossesses");
const carteGrossesse = document.getElementById("carte-formulaire-grossesse");
const titreGrossesse = document.getElementById("titre-formulaire-grossesse");
const formulaireGrossesse = document.getElementById("formulaire-grossesse");
const messageFormGrossesse = document.getElementById("message-formulaire-grossesse");
const boutonGrossesse = document.getElementById("btn-enregistrer-grossesse");
const boutonNouvelleGrossesse = document.getElementById("btn-nouvelle-grossesse");

let praticiens = [];
let grossesses = [];
let idGrossesseEnEdition = null;

function nomPraticien(id) {
  const p = praticiens.find((x) => x.id_praticien === id);
  return p ? `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() : "";
}

function remplirListesEquipe() {
  for (const { champ, specialite } of ROLES) {
    const select = document.getElementById("g_" + champ);
    select.replaceChildren(new Option("— non renseigné —", ""));
    for (const p of praticiens.filter((x) => x.specialite === specialite)) {
      select.append(new Option(`${p.prenom ?? ""} ${p.nom ?? ""}`.trim(), String(p.id_praticien)));
    }
  }
}

async function chargerPraticiens() {
  const { data, error } = await db
    .from("praticien")
    .select("*")
    .order("nom", { ascending: true });
  if (error) {
    afficherMessage(messageGrossesses, "Impossible de lire les praticiens : " + error.message, "erreur");
    return false;
  }
  praticiens = data;
  remplirListesEquipe();
  return true;
}

function texteResultat(valeur) {
  if (valeur === true) return "positif";
  if (valeur === false) return "négatif";
  return "";
}

function texteDuree(temps) {
  return temps ? temps.slice(0, 5).replace(":", " h ") : "";
}

function afficherGrossesses() {
  listeGrossesses.replaceChildren();
  if (grossesses.length === 0) {
    afficherMessage(messageGrossesses, "Aucune grossesse enregistrée pour cette patiente.");
    return;
  }
  afficherMessage(messageGrossesses, `${grossesses.length} grossesse(s)`);

  for (const g of grossesses) {
    const tr = document.createElement("tr");
    const equipe = ROLES.map((r) => nomPraticien(g[r.champ])).filter(Boolean).join(", ");
    tr.append(
      cellule(formaterDate(g.debut)),
      cellule(g.parite === null ? "" : String(g.parite)),
      cellule(texteResultat(g.hiv)),
      cellule(texteResultat(g.toxo)),
      cellule(texteDuree(g.duree_travail)),
      cellule(texteDuree(g.duree_expulsion)),
      cellule(equipe),
    );

    const tdAction = document.createElement("td");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton secondaire petit";
    bouton.textContent = "Modifier";
    bouton.addEventListener("click", () => ouvrirFormulaireGrossesse(g));
    const boutonSuivi = document.createElement("button");
    boutonSuivi.type = "button";
    boutonSuivi.className = "bouton secondaire petit";
    boutonSuivi.textContent = "Suivi du travail";
    boutonSuivi.addEventListener("click", () => {
      patienteChoisie = g.id_patiente;
      grossesseChoisie = g.id_grossesse;
      afficherPage("suivi");
    });
    tdAction.append(bouton, " ", boutonSuivi);
    tr.append(tdAction);

    listeGrossesses.append(tr);
  }
}

async function chargerGrossesses() {
  fermerFormulaireGrossesse();
  listeGrossesses.replaceChildren();
  const idPatiente = Number(choixPatiente.value);
  if (!idPatiente) {
    grossesses = [];
    boutonNouvelleGrossesse.disabled = true;
    afficherMessage(messageGrossesses, "Choisissez une patiente.");
    return;
  }
  boutonNouvelleGrossesse.disabled = false;
  afficherMessage(messageGrossesses, "Chargement…");
  const { data, error } = await db
    .from("grossesse")
    .select("*")
    .eq("id_patiente", idPatiente)
    .order("debut", { ascending: false });
  if (error) {
    afficherMessage(messageGrossesses, "Impossible de lire les grossesses : " + error.message, "erreur");
    return;
  }
  grossesses = data;
  afficherGrossesses();
}

async function chargerPageGrossesses() {
  await chargerPatientes();
  if (praticiens.length === 0) await chargerPraticiens();

  const choix = patienteChoisie ?? (Number(choixPatiente.value) || null);
  choixPatiente.replaceChildren();
  for (const p of patientes) {
    const nom = `${(p.nom ?? "").toUpperCase()} ${p.prenom ?? ""}`.trim();
    choixPatiente.append(new Option(nom, String(p.id_patiente)));
  }
  if (choix !== null && patientes.some((p) => p.id_patiente === choix)) {
    choixPatiente.value = String(choix);
  }
  patienteChoisie = null;
  await chargerGrossesses();
}

function versTexteBool(valeur) {
  return valeur === null || valeur === undefined ? "" : String(valeur);
}

function ouvrirFormulaireGrossesse(grossesse) {
  idGrossesseEnEdition = grossesse ? grossesse.id_grossesse : null;
  titreGrossesse.textContent = grossesse
    ? "Modifier la grossesse"
    : `Nouvelle grossesse — ${choixPatiente.selectedOptions[0]?.textContent ?? ""}`;

  document.getElementById("g_debut").value = grossesse?.debut ?? "";
  document.getElementById("g_parite").value = grossesse?.parite ?? "";
  document.getElementById("g_hiv").value = versTexteBool(grossesse?.hiv);
  document.getElementById("g_toxo").value = versTexteBool(grossesse?.toxo);
  document.getElementById("g_duree_travail").value = grossesse?.duree_travail?.slice(0, 5) ?? "";
  document.getElementById("g_duree_expulsion").value = grossesse?.duree_expulsion?.slice(0, 5) ?? "";
  for (const { champ } of ROLES) {
    document.getElementById("g_" + champ).value = grossesse?.[champ] == null ? "" : String(grossesse[champ]);
  }

  afficherMessage(messageFormGrossesse, "");
  carteGrossesse.hidden = false;
  carteGrossesse.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("g_debut").focus();
}

function fermerFormulaireGrossesse() {
  carteGrossesse.hidden = true;
  idGrossesseEnEdition = null;
}

function texteOuNull(id) {
  const v = document.getElementById(id).value.trim();
  return v === "" ? null : v;
}

formulaireGrossesse.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();

  const parite = texteOuNull("g_parite");
  const valeurs = {
    debut: texteOuNull("g_debut"),
    parite: parite === null ? null : Number(parite),
    hiv: texteOuNull("g_hiv") === null ? null : document.getElementById("g_hiv").value === "true",
    toxo: texteOuNull("g_toxo") === null ? null : document.getElementById("g_toxo").value === "true",
    duree_travail: texteOuNull("g_duree_travail"),
    duree_expulsion: texteOuNull("g_duree_expulsion"),
  };
  for (const { champ } of ROLES) {
    const v = texteOuNull("g_" + champ);
    valeurs[champ] = v === null ? null : Number(v);
  }

  boutonGrossesse.disabled = true;
  afficherMessage(messageFormGrossesse, "Enregistrement…");

  const requete = idGrossesseEnEdition === null
    ? db.from("grossesse").insert({ ...valeurs, id_patiente: Number(choixPatiente.value) }).select()
    : db.from("grossesse").update(valeurs).eq("id_grossesse", idGrossesseEnEdition).select();
  const { data, error } = await requete;

  boutonGrossesse.disabled = false;

  if (error) {
    afficherMessage(messageFormGrossesse, "Échec de l'enregistrement : " + error.message, "erreur");
    return;
  }
  if (!data || data.length === 0) {
    afficherMessage(messageFormGrossesse, "Rien n'a été enregistré : la base a refusé l'opération (droits d'accès).", "erreur");
    return;
  }

  await chargerGrossesses();
});

choixPatiente.addEventListener("change", chargerGrossesses);
boutonNouvelleGrossesse.addEventListener("click", () => ouvrirFormulaireGrossesse(null));
document.getElementById("btn-annuler-grossesse").addEventListener("click", fermerFormulaireGrossesse);
