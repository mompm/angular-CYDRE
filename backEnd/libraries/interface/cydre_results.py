# -*- coding: utf-8 -*-
"""
Created on Tue Mar 26 11:28:43 2024

@author: nicol
"""

import numpy as np

from dash import html, dcc, dash_table
import dash_daq as daq


def display_cydre_results(df, typology_fig, streamflow_fig, results, watershed_info):
    
    
    first_date = results.simulation_date.strftime("%d/%m/%Y")
    last_date = results.projection_period[-1].strftime("%d/%m/%Y")
    


    return html.Div([
                    
                    # SEASONAL FORECAST VIZUALISATION
                    html.Div(
                        style={'backgroundColor': '#DDF3FC',
                               'color': 'k',
                               'border-top-left-radius': '10px', 'border-top-right-radius': '10px',
                               'box-shadow': '0px 0px 10px 0px rgba(0,0,0,0.5)',
                               #'borderRadius': '10px',
                               'padding': '1px',
                               },
                        children=[
                            html.H3('Prévisions saisonnières - Indicateurs opérationnels', 
                                    style={'fontSize': '18px',
                                           "fontWeight": "bold",
                                           "textAlign": "center",
                                           "align-items": "center",
                                           "margin-top":"10px",
                                           "margin-bottom":"10px"})
                        ]
                    ),
                    
                    # Vizualisation
                    html.Div(
                        
                        style = {'border-top-left-radius': '5px', 'border-top-right-radius': '5px',
                        'border-bottom-left-radius': '5px', 'border-bottom-right-radius': '5px',
                        'box-shadow': '0px 0px 10px 0px rgba(0,0,0,0.5)',
                        'margin-bottom': '20px',
                        'margin-top': '20px',},
                        
                        children = [
                            
                            html.H4("Visualisation des prévisions saisonnières", 
                                    style = {'margin-left':'30px', 'padding-top':'20px',
                                             "fontWeight": "bold", "fontSize":"16px"}),
                            
                            # Hydrograph options
                            html.P("échelle linéaire | échelle logarithmique",
                                   style={"textAlign": "center"}),
                            daq.BooleanSwitch(id="forecast-hydrograph-scale", on=False),
                            
                            html.Div(
                                
                                style={'display': 'flex',
                                       'flex-direction': 'row',
                                       'justify-content': 'space-between',
                                       'margin-right': '40px',
                                       'margin-left': '40px'},
                                
                                children = [
                                    
                                    html.Div(dcc.Graph(id="streamflow_proj_figure", figure=streamflow_fig),
                                             style={
                                                 'width': '70%',
                                                 #'color': '#0074D9',
                                                 'padding': '5px',
                                                 'margin': '0 auto',
                                                 'display': 'inline-block',
                                                 'justify-content':'center'},),
                                    
                                    ]),
                            ]),
                    
                    # Operational indicators        
                    html.Div(
                        
                        style = {'border-top-left-radius': '5px', 'border-top-right-radius': '5px',
                        'border-bottom-left-radius': '5px', 'border-bottom-right-radius': '5px',
                        'box-shadow': '0px 0px 10px 0px rgba(0,0,0,0.5)',
                        'margin-bottom': '20px',
                        'margin-top': '20px',},
                        
                        children = [
                            
                            html.H4("Indicateurs opérationnels", 
                                    style = {'margin-left':'30px', 'margin-bottom':'20px', 'padding-top':'20px',
                                             "fontWeight": "bold", "fontSize":"16px"}),

                            
                            html.Div(
                                
                                style={'display': 'flex',
                                       'flex-direction': 'row',
                                       'justify-content': 'space-between',
                                       'margin-right': '40px',
                                       'margin-left': '40px'},
                                
                                children = [
                                    html.Div([
                                        html.P(f"{round(results.proj_values.Q50, 2)}", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"28px"}),
                                        html.P(f"[{np.min([np.round(results.proj_values.Q10, 3), np.round(results.proj_values.Q90, 3)])} - {np.max([np.round(results.proj_values.Q10, 3), np.round(results.proj_values.Q90, 3)])}]", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"14px"}),
                                        html.P(f"Valeur du débit au {last_date} en m3/s. \nCela représente une évolution de {round(results.proj_values_ev['Q50'], 1)} %", style={"textAlign":"center", "fontSize":"14px"}),
                                        ]),
                                    
                                    html.Div([
                                        html.P(f"{results.ndays_before_alert_Q50}", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"28px"}),
                                        html.P(f"[{results.ndays_before_alert_Q90} - {results.ndays_before_alert_Q10}]", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"14px"}),
                                        html.P(f"Nombre de jours avant que le 1/10 du module soit atteint.", style={"textAlign":"center", "fontSize":"14px"}),
                                        ]),
                                    
                                    html.Div([
                                        html.P(f"{results.ndays_below_alert.Q50}", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"28px"}),
                                        html.P(f"[{results.ndays_below_alert.Q90} - {results.ndays_below_alert.Q10}]", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"14px"}),
                                        html.P(f"Nombre de jours cumulés sous le 1/10 du module", style={"textAlign":"center", "fontSize":"14px"}),
                                        ]),
                                    
                                    html.Div([
                                        html.P(f"{round(results.prop_alert_all_series * 100, 1)} %", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"28px"}),
                                        html.P(f"[ - ]", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"14px"}),
                                        html.P(f"Proportion d'événements où le 1/10 du module est atteint dans les prochains mois", style={"textAlign":"center", "fontSize":"14px"}),
                                        ]),
                                    
                                    html.Div([
                                        html.P(f"{int(results.volume50)} m3", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"28px"}),
                                        html.P(f"[{int(results.volume10)} - {int(results.volume10)}]", style={"textAlign":"center", "fontWeight": "bold", "fontSize":"14px"}),
                                        html.P(f"Volume manquant pour compenser le dépassement du 1/10 du module", style={"textAlign":"center", "fontSize":"14px"}),
                                        ]),
                                    ]
                                
                                ),
                        
                            
                            html.P(f"*La date de simulation a été réajustée au {first_date} pour améliorer la qualité des projections. Le réajustement s'effectue lorsque la date de simulation est réalisée sur des événements de précipitations.",
                                   style={'padding-top':'5px', 'fontSize':'14px', "fontStyle": "italic", 'textAlign':"justify",
                                          'margin-left':'10px', 'margin-right':'10px', 'margin-bottom':'10px', 'padding-bottom':'20px'}),
                            
                            ]
                        
                        ),
                    
                    # HISTORICAL-CORRELATIVE ANALYSIS
                    html.Div(
                        style={'backgroundColor': '#DDF3FC',
                               'color': 'k',
                               'margin-top': '50px',
                               'margin-bottom': '20px',
                               'box-shadow': '0px 0px 10px 0px rgba(0,0,0,0.5)',
                               'border-top-left-radius': '10px', 'border-top-right-radius': '10px',
                               #'borderRadius': '10px',
                               'padding': '1px',
                               },
                        children=[
                            html.H3('Interprétation - Analyse de similarité', 
                                    style={'fontSize': '18px',
                                           "fontWeight": "bold",
                                           "textAlign": "center",
                                           "align-items": "center",
                                           "margin-top":"10px",
                                           "margin-bottom":"10px"})
                        ]
                    ),
                    
                    # Correlation matrix
                    
                    html.Div(
                        
                        style={'display': 'flex',
                               'flex-direction': 'row',
                               'justify-content': 'space-between',
                               #'border': '2px solid grey',
                               'border-top-left-radius': '5px', 'border-top-right-radius': '5px',
                               'border-bottom-left-radius': '5px', 'border-bottom-right-radius': '5px',
                               #'box-shadow': '0px 0px 10px 0px rgba(0,0,0,0.5)',
                               "margin-bottom":"10px",},
                        
                        children = [
                        
                        
                        html.Div([
                            html.H4("Matrice de corrélation", 
                                   style = {'margin-left':'30px', 'margin-bottom':'20px', 'padding-top':'20px',
                                            "fontWeight": "bold", "fontSize":"16px"}),
                            html.P(f"Quand, et où, a-t-on retrouvé des conditions initiales similaires à la date du {first_date} mesurées à la station hydrologique {results.watershed_name} ?", 
                                   style={"fontSize":"14px", "testAlign":"justify", "margin-left":"5px", "margin-right":"5px"}),
                            html.P(f"Les conditions initiales sont estimées sur les débits de cours d'eau, la recharge et la profondeur des nappes.", 
                                   style={"fontSize":"14px", "fontStyle": "italic", "testAlign":"justify", "margin-left":"5px", "margin-right":"5px"}),
                            html.Div(dash_table.DataTable(
                                id='corr_matrix_table',
                                columns=[{'name': 'Quand ?', 'id': 'Year'},  # Modifier le nom de la colonne 'Year'
                                        {'name': 'Où ?', 'id': 'ID'},  # Modifier le nom de la colonne 'ID'
                                        {'name': 'Quelle proximité ?', 'id': 'Coeff'}  # Modifier le nom de la colonne 'Coeff'],  # Spécifier les colonnes
                                        ],
                                data=df.to_dict('records'),  # Spécifier les données
                                page_size=10,
                                sort_action='native',
                                style_as_list_view=True,
                                sort_by=[{'column_id': 'Coeff', 'direction': 'desc'}],
                                #style_table={'width': '35%',
                                 #            'height':350,
                                  #           'display': 'inline-block',
                                   #          'margin-right': '10px'},
                                style_header={
                                           'backgroundColor': '#3e4e68',
                                           'color':'#fff',
                                           'fontWeight': 'bold',
                                           'fontSize':'14px',
                                           },
                                style_cell={'whiteSpace': 'normal',
                                            'fontSize':'12px',
                                            'textAlign': 'center'}
                                ),
                               style={
                                    'width': '90%',
                                    #'color': '#0074D9',
                                    'padding': '5px',
                                    'display': 'inline-block',
                                    'font-family': 'Helvetica Neue", Helvetica, Arial, sans-serif'},
                                )    
                            ],
                            style={"align-items": "center",  # Alignez les éléments verticalement
                                   "textAlign":"center",
                                   "margin-right":"10px",
                                   "width":"100%",
                                   'border-top-left-radius': '5px', 'border-top-right-radius': '5px',
                                   'border-bottom-left-radius': '5px', 'border-bottom-right-radius': '5px',
                                   'box-shadow': '0px 0px 10px 0px rgba(0,0,0,0.5)',}),
                        
                        # Spatial similarity
                        html.Div([
                            html.H4("Bassins versants similaires", 
                                    style = {'margin-left':'30px', 'margin-bottom':'20px', 'padding-top':'20px',
                                             "fontWeight": "bold", "fontSize":"16px"}),
                            html.Div(dcc.Graph(id="typology_map_figure", figure=typology_fig),
                                     style={
                                         'width': '100%',
                                         'height':'10%',
                                         #'color': '#0074D9',
                                         'padding': '5px',
                                         'display': 'inline-block'},
                                     )
                            ],
                            style={"align-items": "center",  # Alignez les éléments verticalement
                                   "textAlign":"center",
                                   "margin-left":"10px",
                                   #"margin-top":"10px",
                                   "width":"100%",
                                   'border-top-left-radius': '5px', 'border-top-right-radius': '5px',
                                   'border-bottom-left-radius': '5px', 'border-bottom-right-radius': '5px',
                                   'box-shadow': '0px 0px 10px 0px rgba(0,0,0,0.5)',}),
                        
                        ]),
                    
                    
                    ])
    return None