# -*- coding: utf-8 -*-
"""
Created on Thu Aug 31 20:25:44 2023

@author: Nicolas Cornette
"""

import os
import platform

def set_cydre_environment_variable(cydre_path):
    # Determine the platform (Windows or Linux)
    current_platform = platform.system()

    if current_platform == "Windows":
        print("Windows")
        os.system(f"setx CYDRE_ANGULAR {cydre_path}")  # Set environment variable for Windows
    elif current_platform == "Linux":
        print("Linux")
        os.system(f'echo "export CYDRE_ANGULAR={cydre_path}" >> ~/.bashrc')  # Set environment variable for Linux
        os.system(f'source ~/.bashrc')  # Refresh the shell environment
    else:
        print("Other")
        print(current_platform)

def main():
    #cydre_path = input("Enter the path to the Cydre installation directory: ")
    cydre_path = os.path.dirname(os.path.abspath(os.path.dirname(__file__)))
    set_cydre_environment_variable(cydre_path)
    print("CYDRE environment variable has been set.")

if __name__ == "__main__":
    main()