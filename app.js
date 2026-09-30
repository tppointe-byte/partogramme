// Adresse et clé publishable de votre projet Supabase : dans config.js (écrit par Connecter-Supabase.bat).
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_KEY = window.SUPABASE_KEY;

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CHAMPS = ["nom", "nom_marital", "prenom", "gs_rh", "date_naissance"];

const liste = document.getElementById("liste");
const messageListe = document.getElementById("message-liste");
const carteFormulaire = document.getElementById("carte-formulaire");
const titreFormulaire = document.getElementById("titre-formulaire");
const formulaire = document.getElementById("formulaire");
const messageFormulaire = document.getElementById("message-formulaire");
const boutonEnregistrer = document.getElementById("btn-enregistrer");

let patientes = [];
let idEnEdition = null;
let patienteChoisie = null;
let grossesseChoisie = null;

function afficherPage(nom) {
  for (const page of document.querySelectorAll(".page")) {
    page.hidden = page.id !== "page-" + nom;
  }
  for (const onglet of document.querySelectorAll(".onglet")) {
    onglet.classList.toggle("actif", onglet.dataset.page === nom);
  }
  document.getElementById("btn-export").hidden = nom !== "suivi";
  if (nom === "patientes") chargerPatientes();
  if (nom === "grossesses") chargerPageGrossesses();
  if (nom === "suivi") chargerPageSuivi();
  if (nom === "enfants") chargerPageEnfants();
  if (nom === "praticiens") chargerPagePraticiens();
}

for (const onglet of document.querySelectorAll(".onglet")) {
  onglet.addEventListener("click", () => afficherPage(onglet.dataset.page));
}

function afficherMessage(element, texte, type = "") {
  element.textContent = texte;
  element.className = "message" + (type ? " " + type : "");
}

function formaterDate(iso) {
  if (!iso) return "";
  const [annee, mois, jour] = iso.split("-");
  return `${jour}/${mois}/${annee}`;
}

function cellule(texte) {
  const td = document.createElement("td");
  if (texte) td.textContent = texte;
  else { td.textContent = "—"; td.className = "vide"; }
  return td;
}

function afficherListe() {
  liste.replaceChildren();
  if (patientes.length === 0) {
    afficherMessage(messageListe, "Aucune patiente pour l'instant.");
    return;
  }
  afficherMessage(messageListe, `${patientes.length} patiente(s)`);

  for (const p of patientes) {
    const tr = document.createElement("tr");
    tr.append(cellule(p.nom), cellule(p.nom_marital), cellule(p.prenom));

    const tdGroupe = document.createElement("td");
    if (p.gs_rh) {
      const pastille = document.createElement("span");
      pastille.className = "pastille";
      pastille.textContent = p.gs_rh;
      tdGroupe.append(pastille);
    } else {
      tdGroupe.textContent = "—";
      tdGroupe.className = "vide";
    }
    tr.append(tdGroupe, cellule(formaterDate(p.date_naissance)));

    const tdAction = document.createElement("td");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton secondaire petit";
    bouton.textContent = "Modifier";
    bouton.addEventListener("click", () => ouvrirFormulaire(p));
    const boutonGrossesses = document.createElement("button");
    boutonGrossesses.type = "button";
    boutonGrossesses.className = "bouton secondaire petit";
    boutonGrossesses.textContent = "Grossesses";
    boutonGrossesses.addEventListener("click", () => {
      patienteChoisie = p.id_patiente;
      afficherPage("grossesses");
    });
    tdAction.append(bouton, " ", boutonGrossesses);
    tr.append(tdAction);

    liste.append(tr);
  }
}

async function chargerPatientes() {
  afficherMessage(messageListe, "Chargement…");
  const { data, error } = await db
    .from("patiente")
    .select("*")
    .order("nom", { ascending: true })
    .order("prenom", { ascending: true });

  if (error) {
    afficherMessage(messageListe, "Impossible de lire les patientes : " + error.message, "erreur");
    return;
  }
  patientes = data;
  afficherListe();
}

function ouvrirFormulaire(patiente) {
  idEnEdition = patiente ? patiente.id_patiente : null;
  titreFormulaire.textContent = patiente
    ? `Modifier ${patiente.prenom ?? ""} ${patiente.nom ?? ""}`.trim()
    : "Nouvelle patiente";
  for (const champ of CHAMPS) {
    document.getElementById(champ).value = patiente?.[champ] ?? "";
  }
  afficherMessage(messageFormulaire, "");
  carteFormulaire.hidden = false;
  carteFormulaire.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("nom").focus();
}

function fermerFormulaire() {
  carteFormulaire.hidden = true;
  idEnEdition = null;
}

formulaire.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();

  const valeurs = {};
  for (const champ of CHAMPS) {
    const texte = document.getElementById(champ).value.trim();
    valeurs[champ] = texte === "" ? null : texte;
  }

  boutonEnregistrer.disabled = true;
  afficherMessage(messageFormulaire, "Enregistrement…");

  const requete = idEnEdition === null
    ? db.from("patiente").insert(valeurs).select()
    : db.from("patiente").update(valeurs).eq("id_patiente", idEnEdition).select();
  const { data, error } = await requete;

  boutonEnregistrer.disabled = false;

  if (error) {
    afficherMessage(messageFormulaire, "Échec de l'enregistrement : " + error.message, "erreur");
    return;
  }
  if (!data || data.length === 0) {
    afficherMessage(messageFormulaire, "Rien n'a été enregistré : la base a refusé l'opération (droits d'accès).", "erreur");
    return;
  }

  fermerFormulaire();
  await chargerPatientes();
});

document.getElementById("btn-nouvelle").addEventListener("click", () => ouvrirFormulaire(null));
document.getElementById("btn-annuler").addEventListener("click", fermerFormulaire);
