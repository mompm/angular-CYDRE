# -*- coding: utf-8 -*-
"""
Created on Mon Jan 15 11:10:38 2024

@author: Nicolas Cornette
"""

import os
import sys


def setup_cydre_path():
    
    # Get the value of the "CYDRE" environment variable
    #app_root = "C:\\Users\\monab\\Desktop\\CydreAngular\\cydre-angular\\backEnd"
    app_root = os.getenv("CYDRE_DASH")

    if app_root is None:
        raise ValueError("The 'CYDRE' environment variable is not defined.")

    if app_root not in sys.path:
        sys.path.append(app_root)
        
    return app_root
# -*- coding: utf-8 -*-
"""
Created on Mon Jan 15 11:10:38 2024

@author: Nicolas Cornette
"""

import os
import sys


def setup_cydre_path():
    
    # Get the value of the "CYDRE" environment variable
    app_root = os.getenv("CYDRE_DASH")

    if app_root is None:
        raise ValueError("The 'CYDRE' environment variable is not defined.")

    if app_root not in sys.path:
        sys.path.append(app_root)
        
    return app_root
