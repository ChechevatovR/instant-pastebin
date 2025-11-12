#include <stdio.h>
#include "m_argv.h"

void D_DoomMain (void);

void M_FindResponseFile(void);

int doom_entry(int argc, char **argv)
{
    // save arguments

    myargc = argc;
    myargv = argv;
    
    M_FindResponseFile();

    // start doom
    printf("Starting D_DoomMain\r\n");


	D_DoomMain ();

    return 0;
}

