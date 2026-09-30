const suiviPatiente = document.getElementById("suivi-patiente");
const suiviGrossesse = document.getElementById("suivi-grossesse");
const suiviPastilles = document.getElementById("suivi-pastilles");
const messageSuivi = document.getElementById("message-suivi");
const suiviContenu = document.getElementById("suivi-contenu");
const carteEquipe = document.getElementById("carte-equipe");
const listeEquipe = document.getElementById("liste-equipe");
const carteCourbe = document.getElementById("carte-courbe");
const listeExamens = document.getElementById("liste-examens");
const messageExamens = document.getElementById("message-examens");
const titreExamen = document.getElementById("titre-formulaire-examen");
const formulaireExamen = document.getElementById("formulaire-examen");
const messageFormExamen = document.getElementById("message-formulaire-examen");
const boutonExamen = document.getElementById("btn-enregistrer-examen");
const boutonAnnulerExamen = document.getElementById("btn-annuler-examen");

const COULEURS_EQUIPE = ["#0f9b8a", "#4f46e5", "#d97706", "#e11d48"];

let orientations = [];
let grossessesDuSuivi = [];
let examens = [];
let idExamenEnEdition = null;
let courbe = null;

const deuxChiffres = (n) => String(n).padStart(2, "0");

function heureLocale(date) {
  return `${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`;
}

function formaterDateHeure(iso) {
  const d = new Date(iso);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} ${heureLocale(d)}`;
}

function valeurDatetimeLocal(date) {
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}T${heureLocale(date)}`;
}

function formaterDuree(millisecondes) {
  const minutes = Math.round(millisecondes / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : `${h} h ${deuxChiffres(m)}`;
}

function signe(n) {
  return n > 0 ? `+${n}` : String(n);
}

function calculerAge(dateNaissance) {
  if (!dateNaissance) return null;
  const [a, m, j] = dateNaissance.split("-").map(Number);
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - a;
  const anniversairePasse =
    aujourdhui.getMonth() + 1 > m || (aujourdhui.getMonth() + 1 === m && aujourdhui.getDate() >= j);
  if (!anniversairePasse) age--;
  return age;
}

function nomOrientation(id) {
  return orientations.find((o) => o.id_orientation === id)?.nom_orientation ?? "";
}

function nomPatiente(p) {
  const marital = p.nom_marital ? ` (ép. ${p.nom_marital})` : "";
  return `${p.prenom ?? ""} ${(p.nom ?? "").toUpperCase()}${marital}`.trim();
}

async function chargerOrientations() {
  const { data, error } = await db.from("orientation").select("*").order("id_orientation");
  if (error) {
    afficherMessage(messageSuivi, "Impossible de lire les orientations : " + error.message, "erreur");
    return;
  }
  orientations = data;
  const select = document.getElementById("e_orientation");
  select.replaceChildren(new Option("—", ""));
  for (const o of orientations) select.append(new Option(o.nom_orientation, String(o.id_orientation)));
}

function remplirSelect(select, options, choix) {
  select.replaceChildren();
  for (const [valeur, texte] of options) select.append(new Option(texte, String(valeur)));
  if (choix !== null && options.some(([valeur]) => valeur === choix)) select.value = String(choix);
}

function creerPastille(texte, classe = "") {
  const span = document.createElement("span");
  span.className = "pastille" + (classe ? " " + classe : "");
  span.textContent = texte;
  return span;
}

function afficherFiche() {
  suiviPastilles.replaceChildren();
  listeEquipe.replaceChildren();
  const patiente = patientes.find((p) => p.id_patiente === Number(suiviPatiente.value));
  const grossesse = grossessesDuSuivi.find((g) => g.id_grossesse === Number(suiviGrossesse.value));
  carteEquipe.hidden = !grossesse;
  if (!patiente || !grossesse) return;

  if (patiente.gs_rh) suiviPastilles.append(creerPastille(patiente.gs_rh));
  const age = calculerAge(patiente.date_naissance);
  if (age !== null) suiviPastilles.append(creerPastille(`${age} ans`, "neutre"));

  const serologie = (libelle, valeur, classePositif) => {
    if (valeur === true) return creerPastille(`${libelle} +`, classePositif);
    if (valeur === false) return creerPastille(`${libelle} –`, "bon");
    return creerPastille(`${libelle} ?`, "neutre");
  };
  suiviPastilles.append(serologie("VIH", grossesse.hiv, "alerte"), serologie("Toxo", grossesse.toxo, "attention"));

  ROLES.forEach((role, i) => {
    const id = grossesse[role.champ];
    const praticien = praticiens.find((p) => p.id_praticien === id);
    if (!praticien) return;
    const li = document.createElement("li");
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.style.background = COULEURS_EQUIPE[i % COULEURS_EQUIPE.length];
    avatar.textContent = `${(praticien.prenom ?? "?")[0]}${(praticien.nom ?? "?")[0]}`.toUpperCase();
    const texte = document.createElement("div");
    const nom = document.createElement("strong");
    nom.textContent = `${praticien.prenom ?? ""} ${praticien.nom ?? ""}`.trim();
    const fonction = document.createElement("span");
    fonction.textContent = role.specialite;
    texte.append(nom, fonction);
    li.append(avatar, texte);
    listeEquipe.append(li);
  });
}

async function chargerPageSuivi() {
  await chargerPatientes();
  if (orientations.length === 0) await chargerOrientations();
  if (praticiens.length === 0) await chargerPraticiens();

  const choixPatient = patienteChoisie ?? (Number(suiviPatiente.value) || null);
  remplirSelect(
    suiviPatiente,
    patientes.map((p) => [p.id_patiente, nomPatiente(p)]),
    choixPatient,
  );
  patienteChoisie = null;
  await chargerGrossessesDuSuivi();
}

async function chargerGrossessesDuSuivi() {
  reinitialiserFormulaireExamen();
  const idPatiente = Number(suiviPatiente.value);
  suiviGrossesse.replaceChildren();
  suiviPastilles.replaceChildren();
  grossessesDuSuivi = [];
  suiviContenu.hidden = true;
  carteEquipe.hidden = true;
  document.getElementById("btn-export").disabled = true;
  if (!idPatiente) {
    afficherMessage(messageSuivi, "Choisissez une patiente.");
    return;
  }

  const { data, error } = await db
    .from("grossesse")
    .select("*")
    .eq("id_patiente", idPatiente)
    .order("debut", { ascending: false });
  if (error) {
    afficherMessage(messageSuivi, "Impossible de lire les grossesses : " + error.message, "erreur");
    return;
  }
  if (data.length === 0) {
    afficherMessage(messageSuivi, "Cette patiente n'a pas de grossesse enregistrée.");
    return;
  }

  grossessesDuSuivi = data;
  remplirSelect(
    suiviGrossesse,
    data.map((g) => [g.id_grossesse, `Début ${formaterDate(g.debut)}${g.parite === null ? "" : ` · parité ${g.parite}`}`]),
    grossesseChoisie,
  );
  grossesseChoisie = null;
  afficherFiche();
  await chargerExamens();
}

async function changerGrossesse() {
  afficherFiche();
  await chargerExamens();
}

async function chargerExamens() {
  reinitialiserFormulaireExamen();
  const idGrossesse = Number(suiviGrossesse.value);
  if (!idGrossesse) return;

  afficherMessage(messageSuivi, "Chargement…");
  const { data, error } = await db
    .from("examen")
    .select("*")
    .eq("id_grossesse", idGrossesse)
    .order("date_heure", { ascending: true });
  if (error) {
    afficherMessage(messageSuivi, "Impossible de lire les examens : " + error.message, "erreur");
    return;
  }
  examens = data;
  afficherMessage(messageSuivi, "");
  suiviContenu.hidden = false;
  document.getElementById("btn-export").disabled = false;
  afficherIndicateurs();
  afficherCourbe();
  afficherExamens();
}

function definirIndicateur(id, valeur, detail = "") {
  document.getElementById(id).textContent = valeur;
  document.getElementById(id + "-sub").textContent = detail;
}

function afficherIndicateurs() {
  if (examens.length === 0) {
    definirIndicateur("kpi-dilatation", "—");
    definirIndicateur("kpi-duree", "—");
    definirIndicateur("kpi-hauteur", "—");
    definirIndicateur("kpi-dernier", "—");
    return;
  }
  const premier = examens[0];
  const dernier = examens[examens.length - 1];
  const precedent = examens.length > 1 ? examens[examens.length - 2] : null;
  const dateDernier = new Date(dernier.date_heure);
  const datePremier = new Date(premier.date_heure);

  if (dernier.dilatation === null) {
    definirIndicateur("kpi-dilatation", "—");
  } else if (precedent && precedent.dilatation !== null) {
    const ecart = dernier.dilatation - precedent.dilatation;
    const duree = formaterDuree(dateDernier - new Date(precedent.date_heure));
    definirIndicateur("kpi-dilatation", `${dernier.dilatation} cm`, `${signe(ecart)} cm depuis ${duree}`);
  } else {
    definirIndicateur("kpi-dilatation", `${dernier.dilatation} cm`);
  }

  definirIndicateur("kpi-duree", formaterDuree(dateDernier - datePremier), `depuis ${heureLocale(datePremier)}`);

  if (dernier.presentation_hauteur === null) {
    definirIndicateur("kpi-hauteur", "—");
  } else {
    definirIndicateur(
      "kpi-hauteur",
      signe(dernier.presentation_hauteur),
      dernier.presentation_hauteur >= 0 ? "engagée" : "non engagée",
    );
  }

  definirIndicateur("kpi-dernier", heureLocale(dateDernier), nomOrientation(dernier.id_orientation));
}

function afficherCourbe() {
  if (courbe) {
    courbe.destroy();
    courbe = null;
  }
  const points = examens.filter((e) => e.dilatation !== null);
  carteCourbe.hidden = points.length === 0;
  if (points.length === 0) return;

  const debut = new Date(examens[0].date_heure).getTime();
  const donnees = points.map((e) => ({
    x: (new Date(e.date_heure).getTime() - debut) / 3600000,
    y: e.dilatation,
    examen: e,
  }));
  const xMax = Math.max(8, Math.ceil(Math.max(...donnees.map((d) => d.x))));

  courbe = new Chart(document.getElementById("courbe"), {
    type: "line",
    data: {
      datasets: [{
        data: donnees,
        borderColor: "#0f9b8a",
        borderWidth: 2.5,
        backgroundColor: (contexte) => {
          const { ctx, chartArea } = contexte.chart;
          if (!chartArea) return "rgba(15, 155, 138, 0.15)";
          const degrade = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          degrade.addColorStop(0, "rgba(15, 155, 138, 0.28)");
          degrade.addColorStop(1, "rgba(15, 155, 138, 0)");
          return degrade;
        },
        pointBackgroundColor: "#fff",
        pointBorderColor: "#0f9b8a",
        pointBorderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: "origin",
        clip: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      layout: { padding: { top: 8, right: 12 } },
      scales: {
        x: {
          type: "linear",
          min: 0,
          max: xMax,
          ticks: { stepSize: Math.ceil(xMax / 12), maxRotation: 0, color: "#98a2b3", font: { size: 11 }, callback: (v) => "H" + v },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2, color: "#98a2b3", font: { size: 11 }, padding: 8 },
          grid: { color: "#eef0f3" },
          border: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: "#0f172a",
          cornerRadius: 8,
          padding: 10,
          titleFont: { weight: "700", size: 12 },
          bodyFont: { size: 11 },
          callbacks: {
            title: (elements) => {
              const e = elements[0].raw.examen;
              return `${heureLocale(new Date(e.date_heure))} · ${e.dilatation} cm`;
            },
            label: (element) => {
              const e = element.raw.examen;
              const lignes = [];
              const details = [];
              if (e.presentation_hauteur !== null) details.push(`Hauteur ${signe(e.presentation_hauteur)}`);
              if (e.id_orientation) details.push(nomOrientation(e.id_orientation));
              if (details.length) lignes.push(details.join(" · "));
              if (e.remarque) lignes.push(e.remarque);
              return lignes;
            },
          },
        },
      },
    },
  });
}

function afficherExamens() {
  listeExamens.replaceChildren();
  if (examens.length === 0) {
    afficherMessage(messageExamens, "Aucun examen enregistré pour cette grossesse.");
    return;
  }
  afficherMessage(messageExamens, "");

  for (const e of examens) {
    const tr = document.createElement("tr");
    tr.append(cellule(formaterDateHeure(e.date_heure)));

    const tdDilatation = document.createElement("td");
    if (e.dilatation === null) {
      tdDilatation.textContent = "—";
      tdDilatation.className = "vide";
    } else {
      const barre = document.createElement("div");
      barre.className = "barre";
      const piste = document.createElement("span");
      piste.className = "piste";
      const remplissage = document.createElement("span");
      remplissage.className = "remplissage";
      remplissage.style.width = `${Math.min(100, Math.max(0, e.dilatation * 10))}%`;
      piste.append(remplissage);
      barre.append(piste, `${e.dilatation} cm`);
      tdDilatation.append(barre);
    }
    tr.append(tdDilatation);

    tr.append(cellule(e.presentation_hauteur === null ? "" : signe(e.presentation_hauteur)));

    const tdOrientation = document.createElement("td");
    const nom = nomOrientation(e.id_orientation);
    if (nom) {
      tdOrientation.append(creerPastille(nom, "orientation"));
    } else {
      tdOrientation.textContent = "—";
      tdOrientation.className = "vide";
    }
    tr.append(tdOrientation, cellule(e.remarque));

    const tdAction = document.createElement("td");
    tdAction.style.textAlign = "right";
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton icone";
    bouton.textContent = "✎";
    bouton.title = "Modifier cet examen";
    bouton.setAttribute("aria-label", `Modifier l'examen du ${formaterDateHeure(e.date_heure)}`);
    bouton.addEventListener("click", () => preparerFormulaireExamen(e, true));
    const boutonSuppr = document.createElement("button");
    boutonSuppr.type = "button";
    boutonSuppr.className = "bouton icone";
    boutonSuppr.textContent = "🗑";
    boutonSuppr.title = "Supprimer cet examen";
    boutonSuppr.setAttribute("aria-label", `Supprimer l'examen du ${formaterDateHeure(e.date_heure)}`);
    boutonSuppr.addEventListener("click", () => supprimerExamen(e));
    tdAction.append(bouton, boutonSuppr);
    tr.append(tdAction);

    listeExamens.append(tr);
  }
}

async function supprimerExamen(examen) {
  if (!confirm(`Supprimer l'examen du ${formaterDateHeure(examen.date_heure)} ? Cette action est définitive.`)) return;
  const { data, error } = await db.from("examen").delete().eq("id_examen", examen.id_examen).select();
  if (error) {
    afficherMessage(messageExamens, "Échec de la suppression : " + error.message, "erreur");
    return;
  }
  if (!data || data.length === 0) {
    afficherMessage(messageExamens, "Rien n'a été supprimé : la base a refusé l'opération (droits d'accès).", "erreur");
    return;
  }
  await chargerExamens();
}

function preparerFormulaireExamen(examen, mettreAuPremierPlan) {
  idExamenEnEdition = examen ? examen.id_examen : null;
  titreExamen.textContent = examen ? `Modification de l'examen du ${formaterDateHeure(examen.date_heure)}` : "";
  boutonAnnulerExamen.hidden = !examen;

  document.getElementById("e_date").value = valeurDatetimeLocal(examen ? new Date(examen.date_heure) : new Date());
  document.getElementById("e_dilatation").value = examen?.dilatation ?? "";
  document.getElementById("e_hauteur").value = examen?.presentation_hauteur ?? "";
  document.getElementById("e_orientation").value = examen?.id_orientation == null ? "" : String(examen.id_orientation);
  document.getElementById("e_remarque").value = examen?.remarque ?? "";
  afficherMessage(messageFormExamen, "");

  if (mettreAuPremierPlan) {
    formulaireExamen.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById("e_dilatation").focus();
  }
}

function reinitialiserFormulaireExamen() {
  preparerFormulaireExamen(null, false);
}

function nombreOuNull(id) {
  const v = document.getElementById(id).value.trim();
  return v === "" ? null : Number(v);
}

formulaireExamen.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();

  const date = new Date(document.getElementById("e_date").value);
  if (Number.isNaN(date.getTime())) {
    afficherMessage(messageFormExamen, "La date et l'heure ne sont pas valides.", "erreur");
    return;
  }
  const remarque = document.getElementById("e_remarque").value.trim();
  const valeurs = {
    date_heure: date.toISOString(),
    dilatation: nombreOuNull("e_dilatation"),
    presentation_hauteur: nombreOuNull("e_hauteur"),
    id_orientation: nombreOuNull("e_orientation"),
    remarque: remarque === "" ? null : remarque,
  };

  boutonExamen.disabled = true;
  afficherMessage(messageFormExamen, "Enregistrement…");

  const requete = idExamenEnEdition === null
    ? db.from("examen").insert({ ...valeurs, id_grossesse: Number(suiviGrossesse.value) }).select()
    : db.from("examen").update(valeurs).eq("id_examen", idExamenEnEdition).select();
  const { data, error } = await requete;

  boutonExamen.disabled = false;

  if (error) {
    afficherMessage(messageFormExamen, "Échec de l'enregistrement : " + error.message, "erreur");
    return;
  }
  if (!data || data.length === 0) {
    afficherMessage(messageFormExamen, "Rien n'a été enregistré : la base a refusé l'opération (droits d'accès).", "erreur");
    return;
  }

  await chargerExamens();
});

suiviPatiente.addEventListener("change", chargerGrossessesDuSuivi);
suiviGrossesse.addEventListener("change", changerGrossesse);
document.getElementById("btn-nouvel-examen").addEventListener("click", () => {
  preparerFormulaireExamen(null, true);
});
boutonAnnulerExamen.addEventListener("click", reinitialiserFormulaireExamen);
