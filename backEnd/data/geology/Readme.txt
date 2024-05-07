GEO001M (SIG): Geological Map (prorpriété du BRGM, à ne pas diffuser)
- MassifArm: pour le massif armoricain
- FR_S_FGEOL: à l'échelle nationale

CORRESPONDANCE_TABLE
colonne 1: identifiant de la lithologie dans la table attributaire de la carte géologique (numéro)
colonne 2: nouvel identifiant de la lithologie (groupement de classes)

Les numéros (colonne 1) sont stockés dans la carte géologique et chargeable en Python dans un dataframe
Le descriptif contient le nom de la lithologie, son âge et d'autres informations (discontinuités...)

Les codes de la colonne 2 sont définies de façon Ad Hoc
- AgSa: Argile et Sable ... 
tous les codes sont définis explicitement dans le fichier color_dict du même répertoire

COLOR_DICT
Affecte une couleur à chaque classe lithologique 

lithology
- Watershed: nom du bv
- ID: identifiant de la banque hydro
- SB, SP, AS...: classes lithologiques (% de ces classes pour chaque BV)  