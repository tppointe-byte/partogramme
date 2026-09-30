const boutonExport = document.getElementById("btn-export");
const VERT = "FF0F9B8A";

function dateSeule(iso) {
  return iso ? new Date(iso + "T00:00:00Z") : null;
}

// Excel n'a pas de fuseau horaire : on écrit l'heure locale comme si elle était UTC.
function dateHeureExcel(iso) {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()));
}

function nomDeFichier(patiente, grossesse) {
  const brut = `partogramme_${patiente?.nom ?? ""}_${patiente?.prenom ?? ""}_${grossesse.debut ?? ""}`;
  const propre = brut
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_");
  return propre + ".xlsx";
}

function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function exporterExcel() {
  boutonExport.disabled = true;
  afficherMessage(messageSuivi, "Préparation du fichier Excel…");
  try {
    const idGrossesse = Number(suiviGrossesse.value);
    const patiente = patientes.find((p) => p.id_patiente === Number(suiviPatiente.value));
    const { data: grossesse, error } = await db
      .from("grossesse")
      .select("*")
      .eq("id_grossesse", idGrossesse)
      .single();
    if (error) throw error;
    if (praticiens.length === 0) await chargerPraticiens();

    const classeur = new ExcelJS.Workbook();
    classeur.creator = "Partogramme";
    classeur.created = new Date();
    const feuille = classeur.addWorksheet("Partogramme");
    feuille.columns = [
      { width: 22 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 40 },
    ];

    feuille.getCell("A1").value = "Partogramme";
    feuille.getCell("A1").font = { bold: true, size: 16, color: { argb: VERT } };

    const nomComplet = `${(patiente?.nom ?? "").toUpperCase()} ${patiente?.prenom ?? ""}`.trim();
    const infos = [
      ["Patiente", nomComplet + (patiente?.nom_marital ? ` (ép. ${patiente.nom_marital})` : "")],
      ["Née le", dateSeule(patiente?.date_naissance)],
      ["Groupe sanguin", patiente?.gs_rh ?? ""],
      ["Début de grossesse", dateSeule(grossesse.debut)],
      ["Parité", grossesse.parite],
      ["VIH", texteResultat(grossesse.hiv)],
      ["Toxoplasmose", texteResultat(grossesse.toxo)],
      ["Durée du travail", texteDuree(grossesse.duree_travail)],
      ["Durée de l'expulsion", texteDuree(grossesse.duree_expulsion)],
      ...ROLES.map((r) => [r.specialite, nomPraticien(grossesse[r.champ])]),
    ];
    let ligne = 3;
    for (const [libelle, valeur] of infos) {
      const cLibelle = feuille.getCell(ligne, 1);
      const cValeur = feuille.getCell(ligne, 2);
      cLibelle.value = libelle;
      cLibelle.font = { bold: true };
      cValeur.value = valeur === "" ? null : valeur;
      cValeur.alignment = { horizontal: "left" };
      if (valeur instanceof Date) cValeur.numFmt = "dd/mm/yyyy";
      ligne++;
    }

    ligne++;
    const enTete = ["Date et heure", "Temps écoulé (h)", "Dilatation (cm)", "Hauteur", "Orientation", "Remarque"];
    enTete.forEach((titre, i) => {
      const cellule = feuille.getCell(ligne, i + 1);
      cellule.value = titre;
      cellule.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERT } };
      cellule.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    feuille.views = [{ showGridLines: false }];
    ligne++;

    const debut = examens.length ? new Date(examens[0].date_heure).getTime() : 0;
    for (const e of examens) {
      const heures = Math.round(((new Date(e.date_heure).getTime() - debut) / 3600000) * 100) / 100;
      const valeurs = [
        dateHeureExcel(e.date_heure),
        heures,
        e.dilatation,
        e.presentation_hauteur,
        nomOrientation(e.id_orientation) || null,
        e.remarque,
      ];
      valeurs.forEach((valeur, i) => {
        const cellule = feuille.getCell(ligne, i + 1);
        cellule.value = valeur;
        cellule.alignment = { horizontal: i === 5 ? "left" : "center", vertical: "middle", wrapText: i === 5 };
        cellule.border = { bottom: { style: "thin", color: { argb: "FFE4E7EC" } } };
      });
      feuille.getCell(ligne, 1).numFmt = "dd/mm/yyyy hh:mm";
      feuille.getCell(ligne, 2).numFmt = "0.00";
      ligne++;
    }
    if (examens.length === 0) {
      feuille.getCell(ligne, 1).value = "Aucun examen enregistré";
      feuille.getCell(ligne, 1).font = { italic: true };
      ligne++;
    }

    if (courbe && examens.length > 0) {
      const canvas = courbe.canvas;
      const largeur = 720;
      const hauteur = Math.round((largeur * canvas.height) / canvas.width);
      const image = classeur.addImage({ base64: courbe.toBase64Image("image/png", 1), extension: "png" });
      feuille.getCell(ligne + 1, 1).value = "Courbe de dilatation";
      feuille.getCell(ligne + 1, 1).font = { bold: true };
      feuille.addImage(image, { tl: { col: 0, row: ligne + 1 }, ext: { width: largeur, height: hauteur } });
    }

    const tampon = await classeur.xlsx.writeBuffer();
    const blob = new Blob([tampon], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    telecharger(blob, nomDeFichier(patiente, grossesse));
    afficherMessage(messageSuivi, "Fichier Excel créé.", "ok");
  } catch (erreur) {
    afficherMessage(messageSuivi, "L'export a échoué : " + (erreur.message ?? erreur), "erreur");
  } finally {
    boutonExport.disabled = false;
  }
}

boutonExport.addEventListener("click", exporterExcel);

afficherPage("suivi");
