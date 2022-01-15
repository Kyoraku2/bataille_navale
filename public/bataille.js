/**
 *  Corrigé du TP4. Bataille navale
 */

document.addEventListener("DOMContentLoaded", function() {

    
    /************************************************
     *              Modèle de données               *
     ************************************************/
    
    // Les bateaux du joueur
    var bateaux = { 
        porteavions: { cases: [], max: 5 }, 
        cuirasse: { cases: [], max: 4 },
        contretorpilleur: { cases: [], max: 3 }, 
        sousmarin: { cases: [], max: 3 },
        lancetorpilles: { cases: [], max: 2 }
    }
    
    // Etat du jeu 
    var etat = 0;   // 0 : pas commencé, 1 : partie en cours - en attente, 2 partie en cours - à moi de jouer, 3 partie terminée
        
    // socket ouverte vers le serveur
    var sock = io.connect();
    
    
    /**************************************************
     *                  IHM : grilles                 *
     **************************************************/
    
    function genererGrille(id) {
        // table représentant la grille
        var table = document.createElement("table");
        table.id = id;
            
        ["", "A","B","C","D","E","F","G","H","I","J"].forEach(function(e, ligne) {
            var tr = document.createElement("tr");
            
            for (var i=0; i <= 10; i++) {
                var td = document.createElement("td");
                if (i == 0) {
                    td.innerHTML = e;   
                }
                else if (ligne == 0) {
                    td.innerHTML = i;
                }                
                else {
                    td.dataset.ligne = e;
                    td.dataset.colonne = i;
                }
                tr.appendChild(td);
            }
            table.appendChild(tr);            
        });
        return table;
    }
    
    /** Grille du joueur **/
    var joueur = genererGrille("joueur");
    // placement
    document.querySelector("main section:nth-child(2)").insertBefore(joueur, document.querySelector("main section:nth-child(2) aside"));
    // clic sur le tableau : placement des bateaux si l'état le permet
    joueur.addEventListener("click", function(e) {
        if (etat > 0) {
            return;
        }
        if (e.target.tagName != "TD" || !e.target.dataset.ligne || !e.target.dataset.colonne) {
            return;
        }
        placeBateau(document.querySelector("input[type=radio]:checked").value, e.target);
        // sauvegarde de la grille
        var save = {};
        for (var b in bateaux) {
            save[b] = bateaux[b].cases;   
        }
        localStorage.setItem("grille", JSON.stringify(save));
    });
                
    
    // chargement de la grille depuis le localstorage 
    var loaded = localStorage.getItem("grille");
    if (loaded) {
        loaded = JSON.parse(loaded);
        // loaded : { id_bateau => [ case1, case2, ... ]
        for (var b in loaded) {
            for (var caz in loaded[b]) {
                var l = loaded[b][caz].substr(0,1);
                var c = loaded[b][caz].substr(1);
                placeBateau(b, document.querySelector('section:nth-child(2) [data-ligne="' + l + '"][data-colonne="' + c + '"]'));
            }
        }
    }

    
    /** Grille de l'adversaire **/
    var adversaire = genererGrille("adversaire");
    // placement
    document.querySelector("main section:nth-child(1)").insertBefore(adversaire, document.querySelector("main section:nth-child(1) aside"));
    // écouteur d'événement clic    
    adversaire.addEventListener("click", function(e) {
        if (etat == 0) {
            alert("Aucune partie en cours.");
            return;    
        }
        if (etat == 1) {
            log("Ce n'est pas à ton tour de jouer.", "client");
            return;
        }
        if (e.target.tagName == "TD" && e.target.dataset.ligne && e.target.dataset.colonne) {
            var coords = e.target.dataset.ligne + e.target.dataset.colonne;
            sock.emit("tir", coords);
        }
    });
        
    
    /** Ecouteur du bouton démarrer **/
    document.getElementById("btnDemarrer").addEventListener("click", function() {
        if (etat != 0) {
            return;
        }
        if (!grilleRemplie()) {
            alert("Le remplissage de la grille n'est pas fini.");
            return;
        }
        // préparation des données : 
        var data = {}
        for (var b in bateaux) {
            data[b] = bateaux[b].cases;   
        }
        sock.emit("demarrer", data);
    });

    document.getElementById("btnEnvoyer").addEventListener("click", function() {
        let msg = document.getElementById("txtMsg").value.trim();
        if (msg.length > 0) {
            if (etat != 1 && etat != 2){
                log("La partie est terminée.", "client");
                document.getElementById("txtMsg").value = "";
            }
            else{
                sock.emit("message", msg);
                log("Message envoyé à l'adversaire : <br><em>" + msg + "</em>", "moi");
            }
            document.getElementById("txtMsg").value = "";
            
        }
    });
    
    
    /****************************************************
     *              Fonctions utilitaires               *
     ****************************************************/
    
    /**
     *  Vérifie le bateau. Si la fonction s'exécute jusqu'au bout c'est qu'il n'y a pas d'erreur. 
     */
    function verifierPosition(bateau, ligne, colonne) {
        var bObj = bateaux[bateau];
        if (bObj.cases.length == bObj.max) {
            throw "Toutes les parties de ce bateau sont déjà placées.";
        }
        if (bObj.cases.length == 0) {
            return;
        }
        var coords = ligne + colonne;
        if (bObj.cases.length == 1) {
            if (manhattanDistance(bObj.cases[0], coords) != 1) {
                throw "La deuxième partie du bateau doit être adjacente à la première."; 
            }
            return;
        }
        if (estSurLaMemeLigne(bObj.cases[0], bObj.cases[1])) {
            if (! bObj.cases.some(function(c) { return estSurLaMemeLigne(c, coords) && manhattanDistance(c, coords) == 1; })) {
                throw "La nouvelle partie du bateau doit être adjacente et dans la même direction que les parties déjà posées.";   
            }
        }
        else {
            if (! bObj.cases.some(function(c) { return estSurLaMemeColonne(c, coords) && manhattanDistance(c, coords) == 1; })) {
                throw "La nouvelle partie du bateau doit être adjacente et dans la même direction que les parties déjà posées.";   
            }
        }
    }   
    
    /** Teste si deux coordonnées sont sur la même ligne **/
    function estSurLaMemeLigne(coord1, coord2) {
        return coord1.substr(0,1) == coord2.substr(0,1);   
    }
    
    /** Teste si deux coordonnées sont sur la même colonne **/
    function estSurLaMemeColonne(coord1, coord2) {
        return coord1.substr(1) == coord2.substr(1);   
    }
    /** Calcule la distance de manhattan entre deux coordonnées **/
    function manhattanDistance(coord1, coord2) {
        var deltaLigne = Math.abs(1*coord1.substr(1) - 1*coord2.substr(1));
        var deltaColonne = Math.abs(coord1.charCodeAt(0) - coord2.charCodeAt(0));
        return deltaColonne + deltaLigne;
    }
    
    /** Vérifie si la grille est remplie **/
    function grilleRemplie() {
        for (var b in bateaux) {
            if (bateaux[b].cases.length < bateaux[b].max) {
                return false;   
            }
        }
        return true;
    }
    
     /** Réalise le placement du bateau **/
    function placeBateau(bateau, caseElt) {
        var coords = caseElt.dataset.ligne + caseElt.dataset.colonne;
        if (caseElt.classList.length == 0) {
            try {
                verifierPosition(bateau, caseElt.dataset.ligne, caseElt.dataset.colonne);
                bateaux[bateau].cases.push(coords);
                // tri pour avoir toujours l'accès aux premières et dernières parties du bateau
                bateaux[bateau].cases.sort(function (c1, c2) {
                    return (c1.charCodeAt(0) - c2.charCodeAt(0)) + (1*c1.substr(1) - 1*c2.substr(1));
                });
                caseElt.classList.add(bateau);
            }
            catch (err) {
                alert(err);
            }
        }
        else {
            if (caseElt.classList.contains(bateau)) {
                var indexOf = bateaux[bateau].cases.indexOf(coords);
                if (indexOf == 0 || indexOf == bateaux[bateau].cases.length -1) {
                    bateaux[bateau].cases.splice(indexOf, 1);
                    caseElt.classList.remove(bateau);
                }
                else {
                    alert("Impossible de retirer cette partie du bateau.");   
                }
            }
            else {
                alert("La case contient déjà un autre bateau.");   
            }
        }   
    }
    
    
    function log(msg, origine) {
        var l = document.querySelector("main section:first-child aside");
        l.innerHTML = "<p class='" + origine + "'>" + (new Date()).toLocaleTimeString() + " - " + msg + "</p>" + l.innerHTML;
    }
    
    
    /******************************************************************
     *                   Gestion de la socket                         *
     ******************************************************************/

    sock.on("erreur", function(msg) {
        alert(msg); 
    });
    
    sock.on("en_attente", function(msg) {
        document.body.classList.add("partieEnCours");        
        log(msg, "serveur");
    });
    
    sock.on("a_toi", function(msg) {
        document.body.classList.add("partieEnCours");        
        log(msg, "serveur");
        etat = 2;
    });
    
    sock.on("a_l_autre", function(msg) {
        document.body.classList.add("partieEnCours");        
        log(msg, "serveur");
        etat = 1;
    });
    
    sock.on("resultat", function(result) {
        var txt = ["dans l'eau", "touché", "coulé", "coulé et fin de partie"][result.statut];
        var qui = result.emetteur ? "[Vous]" : "[Adversaire]";
        var ensuite = "";
        if (result.statut == 3) {
            ensuite = "<button onclick='document.location.reload()'>Nouvelle partie</button>";
            etat = 3;
        }
        else {
            ensuite = result.emetteur ? "En attente du tir de l'adversaire." : "A vous de jouer.";   
        }
        log(qui + " Tir en " + result.coords + " : " + txt + "<br>" + ensuite, "serveur");
        
        if (result.coords.substr) {
            var l = result.coords.substr(0,1);
            var c = result.coords.substr(1);
            var which = (result.emetteur) ? 1 : 2;
            var caz = document.querySelector('section:nth-child(' + which + ') [data-ligne="' + l + '"][data-colonne="'+ c + '"]');
            if (caz) {
                caz.classList.add("tir");
            }
            if (result.emetteur && result.statut > 0) {
                document.querySelector('section:nth-child(1) [data-ligne="' + l + '"][data-colonne="'+ c + '"]').classList.add("touche");
            }
        }
        if (result.statut == 3) {
            return;
        }
        etat = (etat == 1) ? 2 : 1;
    });
    
    sock.on("deconnexion", function(msg) {
        log(msg + "<br><br><button onclick='document.location.reload()'>Nouvelle partie</button><br><br>", "serveur");
        etat = 3;
    });
            
    sock.on("message", function(msg) {
        log("Message de votre adversaire : <br><strong><em>" + msg + "</em></strong>", "adversaire");
    });

    
});
