# -*- coding: utf-8 -*-
"""
Created on Tue Mar 26 10:36:18 2024

@author: nicol
"""

from click import style
import pandas as pd
from datetime import date
from dash import html, dcc
import dash_bootstrap_components as dbc
import dash_daq as daq
from libraries.interface.style import *


# Fonction pour la création de la barre de navigation principal (Acceuil)
def create_principal_navbar(selected_tab):
    # Définition des styles pour chaque onglet
    tab_styles = {
        "Accueil": None,
        "FichesSite": None,
        "SimulateurCydre": None,
        "AboutUs": None
    }
    # Mise à jour du style de l'onglet sélectionné
    tab_styles[selected_tab] = {"fontWeight": "bold", "color": "white"}
    navbar = dbc.Navbar(
                dbc.Container([
                        dbc.Row([
                            dbc.Col(html.Img(src="./assets/logo_cydre_seul.png", style={"height": "100px"}), width="auto"),
                            dbc.NavbarBrand(" CYDRE- Outil pour la prévision saisonnière des débits de cours d'eau en Bretagne", className="ml-2"),
                         ],
                         align="center",
                         className="ml-auto flex-nowrap mt-3 mt-md-0",
                         ),
                        dbc.Nav([
                            dbc.NavItem(dbc.NavLink("Accueil", href="/", style=tab_styles["Accueil"])),
                            dbc.NavItem(dbc.NavLink("Fiches de Site", href="/fiches", style=tab_styles["FichesSite"])),
                            dbc.NavItem(dbc.NavLink("Simulateur Cydre", href="/simulateur",style=tab_styles["SimulateurCydre"])),
                            #dbc.NavItem(dbc.NavLink("About us", href="/about",style=tab_styles["AboutUs"])),
                        ],
                        className="ml-auto",
                        navbar=True,
                        ),  
                    ],
                    fluid=True,
                ),
                color="dark",
                dark=True,
            )
    return navbar


# Fonction pour la création de la barre de navigation autre que Acceuil
def create_other_navbar(selected_tab):
    
    # Définition des styles pour chaque onglet
    tab_styles = {
        "Accueil": None,
        "FichesSite": None,
        "SimulateurCydre": None,
        "AboutUs": None
    }
    # Mise à jour du style de l'onglet sélectionné
    tab_styles[selected_tab] = {"fontWeight": "bold", "color": "white"}
    navbar = dbc.Navbar(
                dbc.Container([
                        dbc.Row([
                            dbc.Col(html.Img(src="./assets/logo_cydre_seul.png", style={"height": "100px"}), width="auto"),
                            dbc.NavbarBrand(" CYDRE- Outil pour la prévision saisonnière des débits de cours d'eau en Bretagne", className="ml-2"),
                         ],
                         align="center",
                         className="ml-auto flex-nowrap mt-3 mt-md-0",
                         ),
                        dbc.Nav([
                            dbc.NavItem(dbc.NavLink("Accueil", href="/", style=tab_styles["Accueil"])),
                            dbc.NavItem(dbc.NavLink("Fiches de Site", href="/fiches", style=tab_styles["FichesSite"])),
                            dbc.NavItem(dbc.NavLink("Simulateur Cydre", href="/simulateur",style=tab_styles["SimulateurCydre"])),
                            #dbc.NavItem(dbc.NavLink("About us", href="/about",style=tab_styles["AboutUs"])),
                        ],
                        className="ml-auto",
                        navbar=True,
                        ),  
                    ],
                    fluid=True,
                ),
                color="dark",
                dark=True,
            )
    return navbar


# Fonction pour la création du Footer 
def create_footer():
    footer = html.Div(
                children= [
                    html.Footer(
                        children=[
                            html.Img(src="/assets/logo_brgm_creseb_cnrs.png", style={"height": "100%", "float": "left"}),
                            html.Img(src="./assets/logo_ue_bzh.png", style={"height": "100%", "float": "right"}),
                        ],
                    style=footer_style,
                    )
                ],
            id='footer'
        )
    return footer


def en_tete_layout(gdf_stations, watershed_store):
    
    popover_content = """
    Sélectionner une station hydrologique dans la liste déroulante suivante. 
    Il s'agit des stations pour lesquelles ont été référencées à la fois des données d'observation et des données de modélisation.
    Vous pouvez aussi sélectionner directement la station depuis la carte régionale affichée ci-dessous.
    """
    
    list_of_disabled_options = [
    'J0121510', 'J0323010', 'J1004520', 'J2233010', 'J2233020', 'J2605410', 'J3413030', 'J3601810',
    'J3631810', 'J3821810', 'J3821820', 'J4313010', 'J4614010', 'J4623020', 'J4742010', 'J4902010', 'J5224010', 'J5402120'
    'J5412110', 'J7083110', 'J7114010', 'J7824010', 'J7833010', 'J7973010', 'J8202310', 'J8363110', 'J8443010', 'J8502310', 'J8813010'
    ]

    layout = html.Div([
                html.Div([
                    html.H4("Sélection de la station hydrologique de référence", 
                        id="selection_station",
                        style= style_h4_center
                        ),
                html.Div(
                        dbc.Button(
                            "?",
                            id="info-test",
                            n_clicks=0,
                            style=style_button_info
                            )
                        ),
                dbc.Modal([
                        dbc.ModalHeader(dbc.ModalTitle("Sélection de la station hydrologique")),
                        dbc.ModalBody(dcc.Markdown(popover_content)),
                    ],
                    id="modal-xl",
                    size="xl",
                    is_open=False,
                    )],
                    style= style_button_info_div
                ),
                html.Div([
                    html.Div(
                        dcc.Dropdown(
                            id="watershed",
                            options=[{'label': ID+' - '+label, 'value': ID, 'disabled': True} if ID in list_of_disabled_options
                                else {'label': ID+' - '+label, 'value': ID} for label, ID in zip(gdf_stations['station_name'], gdf_stations['ID'])
                            ],
                            value=watershed_store,
                            placeholder="Sélection de la station hydrologique de référence",
                            style=style_dropdown_station
                        ),
                        style=style_center_ligne,
                    ),
                html.Div([
                    dcc.Link(
                        html.Button(
                            html.Img(
                                src="https://hydro.eaufrance.fr/build/images/hydroportail.png",
                                style={"height": "20px"},
                            ),
                            #"Accéder à la fiche station sur HydroPortail",
                            id="access-button",
                            style= style_button_link_hydroportail
                        ),
                        href="",  # L'URL sera ajoutée dynamiquement
                        target="_blank",  # Ouvrir l'URL dans un nouvel onglet
                        id="access-link",
                    ),
                    dcc.Link(
                        html.Button(
                            html.Img(
                                src="https://ades.eaufrance.fr/Spip?p=squelettes/images/logo-ades.png",
                                style={"height":"20px"},
                            ),
                            id="ades-button",
                            style=style_button_link_ades
                        ),
                        href="",
                        target="_blank",
                        id="ades-link",
                    )],
                    style=style_center_ligne,
                )],
                style= style_choix_station_div
            ),
            html.Div(id='stored'),
        ])
    return layout


def main_layout():
    footer = create_footer()
    layout = html.Div([
            html.Div(id='navbar-content'),
            html.Div(
                children = [
                    dcc.Location(id='url', refresh=False),
                    html.Div(id='page-content'),
                    ],
                style={'flex': '1', 'margin-bottom': '50px', 'margin-left': '10%', 'margin-right': '10%'} 
            ),
            footer,
        ],
        style={'display': 'flex', 'flexDirection': 'column', 'height': '100vh'}  
    )
    return layout


def home_layout():

    layout = html.Div(
        className="body",
        children=[
            html.Div(
                style=style_body_home,
                children=[
                    html.Div(
                        style=style_center_elements_home,
                        children=[
                            html.Div(
                                className="container",
                                style=style_container_haut_home,
                                children=[
                                    html.Div(
                                        className="right-column",
                                        style={"width": "70%", "marginLeft": "20px"},
                                        children=[
                                            html.Div(
                                                style={"padding": "20px"},
                                                children=[
                                                    html.Div(
                                                        style=style_paragraph_home,
                                                        children=[
                                                            html.P(
                                                                "Le projet Cycle hydrologique, Disponibilité de la Ressource et Évolution (CYDRE) a pour objectif général de développer un outil pour la prévision saisonnière des débits de cours d’eau à destination des gestionnaires de bassins versants à l’échelle de la Bretagne. Ce projet devrait ainsi permettre de livrer les éléments nécessaires à la compréhension locale du cycle de l’eau, de proposer un cadre d’analyse homogène à l’échelle régionale sur l’évolution des ressources et de co-construire avec les gestionnaires un outil numérique, simple et opérationnel, permettant de générer des tendances saisonnières de l’évolution des débits à partir de données observables."
                                                            ),
                                                            html.P(
                                                                "Dans les régions de socle cristallin, telles que la Bretagne, les tensions sur la ressource en eau ne sont pas rares malgré un climat tempéré représenté par des précipitations régulières et une évapotranspiration limitée en hiver, conditions souvent favorables à la recharge des eaux souterraines. La vulnérabilité des territoires aux années de sécheresse provient de la faible capacité des aquifères à constituer un stock d’eau mobilisable pour le soutien des cours d’eau pendant l’étiage. La Bretagne ne disposant pas de ressources stratégiques pour atténuer les effets du changement climatique, comme peuvent en avoir les grands bassins sédimentaires, les variations climatiques peuvent rapidement entraîner des conséquences importantes et mettre les activités régionales en tension."
                                                            ),
                                                            html.P(
                                                                "La prévision des effets du changement climatique sur la disponibilité de la ressource en eau présente un enjeu fort de gestion et de développement mais se heurte aux fortes incertitudes autour de l’évolution des précipitations. Des outils de prévisions à court terme, de l’ordre de quelques semaines ou mois, sont alors nécessaires pour anticiper le plus tôt possible le risque sur les étiages et pour la prise de décision des politiques locales."
                                                            ),
                                                        ],
                                                    ),
                                                ],
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                    html.Div(
                        style=style_container_bas_home,
                        children=[
                            html.Div(
                                style={"padding": "20px"},
                                children=[
                                    html.Div(
                                        style=style_paragraph_home,
                                        children=[
                                            html.P(
                                                "Un travail de recherche a été réalisé par Nicolas Cornette dans le cadre du projet EAUX2050et dans sa thèse “Caractérisation des propriétés hydrodynamiques pour l’études des impacts du changement climatique sur les ressources en eau.” (2019-2022). Il a permis de mieux qualifier les propriétés du milieu souterrain et de quantifier son rôle dans le soutien des étiages, en tenant compte de l’hétérogénéité des propriétés hydrodynamiques des différents bassins versants (perméabilité, la diffusivité ou la porosité des milieux souterrains) dans les modèles hydrologiques."
                                            ),
                                            html.P(
                                                "L’objectif général du projet CYDRE est d’utiliser les résultats de modélisation issus de cette thèse afin de fournir des tendances saisonnières de l’évolution des débits aux gestionnaires de bassins versants à l’échelle de la Bretagne. Cette échelle de temps, bien que courte, est pertinente dans le cas des aquifères dominées par une cyclicité annuelle."
                                            ),
                                            html.P(
                                                "Le projet CYDRE est porté par le CNRS et le BRGM. Après avoir animé l’émergence du projet, le Creseb reste un partenaire privilégié pour l’élaboration et la mise en œuvre des activités de diffusion ou d’appropriation des résultats du projet. Le projet est cofinancé par l’Union européenne, la Région Bretagne, le CNRS et le BRGM."
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )

    return layout


def fiche_site_layout(gdf_stations, watershed_store): 
    
    layout_en_tete = en_tete_layout(gdf_stations, watershed_store)
    layout = html.Div([
        #affiche choix station
        layout_en_tete,
        # Header localisation
        html.Div(
            children=[
                html.H3('Localisation du bassin versant', 
                style=style_h3_text)
            ],
            style=style_h3_div,
        ),
        html.Div([            
            # Regional-scale map
            #store_loc,
            dcc.Graph(
                id="regional_map",
                style=style_regional_map
            ),       
            # Watershed-scale map
            html.Iframe(
                id="regional_map2",
                style=style_watershed_map
            )],
        style = style_maps_div
        ),

        html.P(
            "L'association d'une station piézométrique au bassin versant est définie selon 3 critères : 1) proximité géographique; 2) couverture géologique et; 3) cohérence amont/aval.",
            style=style_parapgraphe_without_padding
        ),
                
        html.P(
            "Pour plus d'informations concernant les stations hydrologiques et piézométriques, vous pouvez cliquer sur les logos des plateformes HydroPortail et ADES, en haut de le page, à côté de la liste déroulante de sélection du bassin versant.",
            style=style_parapgraphe_with_padding_visible
        ),        
        
        # Header suivi ressource en eau
        html.Div(
            children=[
                html.H3("Suivi de la ressource en eau", 
                style=style_h3_text)
            ],
            style=style_h3_div,
        ),
        #formulaire pour les graphiques suivi ressource en eau 
        html.Div([
            html.Div([
                dbc.Checklist(
                    id="check_graphs",
                    options=[
                        {'label': 'débit global ', 'value': "g1"},
                        {'label': 'températures', 'value': "g2"},
                        {'label': 'précipitations', 'value': "g3"},
                        {'label': 'débit annuel', 'value': "g4"},
                        {'label': 'profondeur de nappe', 'value': "g5"},
                    ],
                    value=["g1","g2","g3","g4","g5"],
                    switch=True,
                    inline=True,
                    style={'display': 'inline-block'}
                ),
                html.Button(
                    "Afficher les graphiques",
                    id="valider_graphs",
                    n_clicks=0,
                    style={'margin-top': '10px', 'margin-left': '10px', 'display': 'inline-block',"border": "none", "border-radius": "5px","cursor": "pointer"}
                ),
            ], style={'text-align': 'center'}),
        ]),           
        html.Div([
            # Hydrograph options
            html.P(
                "échelle linéaire | échelle logarithmique",
                id="hydrograph-scale-text"
            ),

            daq.BooleanSwitch(
                id="hydrograph-scale", 
                on=False
            ),

            # Global hydrograph - only streamflow (all years are displayed)
            html.Div(
                id = "global-hydrograph-container"
            ),
                    
            html.P(
                f"L'échelle linéaire est adaptée pour la représentation de la dynamique générale des débits et pour identifier les pics de crues. L'échelle logarithmique est particulièrement adaptée pour l'identification des années sèches.",
                id ="paragraphe_hydrograph" 
            ),
                    
            html.H4(
                "Dynamique saisonnière de la ressource en eau",
                id = "title_seasonal_graph"
            ),
                    
            html.P(
                "Choix d'une année à visualiser :",
                id="dropdown_annee_text"
            ),
                    
            # Dropdown to select a specific year
            dcc.Dropdown(
                id="event", 
                options=list(range(1970, 2025)),
                value=[2024],
                multi=True,
                style=style_dropdown_annee_visible
            ),
                    
            # Seasonal plots (streamflow, climatic and piezometric)
            dbc.Row([
                dbc.Col(html.Div(id="seasonal-temperature"), width=6),
                dbc.Col(html.Div(id="seasonal-precipitation"), width=6)
            ]),
            dbc.Row([
                dbc.Col(html.Div(id="seasonal-hydrograph"), width=6),
                dbc.Col(html.Div(id="seasonal-piezometric"), width=6)
            ])
        ],
        style=style_seasonal_plot_div
        ),
                
        # Header suivi hs1D
        html.Div(
                children=[
                html.H3(
                    "Caractérisation des milieux souterrains", 
                    style=style_h3_text
                )],
            style=style_h3_div,
            ),    
        ])
    return layout
        

#layout simulation cydre
def simulation_cydre_layout(gdf_stations, watershed_store):
    
    layout_en_tete = en_tete_layout(gdf_stations, watershed_store)
    layout = html.Div([
        #affiche choix station
        layout_en_tete,
        # Header input parameters
        html.Div(
            style=style_h3_div,
            children=[
                html.H3(
                    'Conditions de la prévision', 
                    style=style_h3_text
                )
            ]
        ),
                
        # Input forecasting parameters
        html.Div(
            style=style_forescating_div,
            children=[            
                # Forecasting horizon
                html.Div([
                    html.H4(
                        "Echéance de la prévision (jours)",
                        style=style_forescastion_parameter_text_top
                    ),
                    html.Div(
                        dcc.Slider(
                            id='points-slider',
                            min = 1,
                            max= 120,
                            step=1,
                            marks = {0:'0',20:'20',40:'40',60:'60',80:'80',100:'100', 120:'120'},
                            value = 1,
                            tooltip={"placement": "bottom", "always_visible": True}
                        ),
                        style=style_slider_days,
                    ),
                    html.P(
                        "Lorsque l'échéance est importante l'incertitude sur les projections augmente.",
                        style=style_slider_days_text_bottom
                    )],
                    style=style_slider_days_div
                ),
                # Simulation date
                html.Div([
                    html.H4(
                        "Date de la simulation",
                        style=style_forescastion_parameter_text_top
                    ),
                    html.Div(
                        dcc.DatePickerSingle(
                            id='my-date-picker-single',
                            #is_RTL=True,
                            min_date_allowed=date(1958, 1, 1),
                            max_date_allowed=pd.to_datetime(date.today()),
                            initial_visible_month=pd.to_datetime(date.today()),
                            date=pd.to_datetime(date.today()),
                            display_format='DD/MM/YYYY',
                            style={'fontSize':'2px'}
                        ),
                        style=style_calendrier,
                    ),
                    html.P(
                        "Par défaut la date de simulation est la date du jour. Il est possible d'effectuer des prévisions à des dates antérieures, notamment pour évaluer la qualité des projections avec les données d'observations",
                        style=style_calendrier_text_bottom
                    )],
                    style=style_calendrier_div
                )]
            ),
                # Run cydre application
                html.Div(
                        style={"textAlign": "center", 'display': 'flex', 'flexDirection': 'column'},
                        children = [
                                html.Div(
                                    style={"textAlign": "center", 'display': 'flex', 'flexDirection': 'column'},
                                    children=[

                                        html.Button("Lancer l'application", id='run-button',
                                                style=style_button_simulation),
                                        html.H6("les calculs durent entre 15s et 1min",
                                                style= style_H6),

                                        ]
                                    ),
                                # Display cydre loading
                                dcc.Loading(id='cydre-loading',
                                            type='circle',
                                            fullscreen=False,
                                            style={'margin-top': '50px', 'margin-bottom': '50px'}
                                        ),
                                
                                html.Div(id='simulation-status'),
                                
                                # Display cydre results 
                                html.Div(id='cydre-results',
                                        style={'margin-top': '30px', 'margin-bottom': '20px'}
                                    ),
                            ]   
                        )
                    ]) 
    return layout    


def about_layout():
    layout = html.Div([ 
        html.H4(
            "about Us"
        )
    ])
    return layout
       

def render_tab_content(active_tab):
    if active_tab is not None:
        
        # Watersheds localisation
        if active_tab == 'loc':
            local_tab = html.Div([
                html.H3("hello")
            ])
        # Cydre forecasting
        elif active_tab == 'forecast':
            local_tab = html.Div([
                html.H3("hello")
            ])
            
    return local_tab