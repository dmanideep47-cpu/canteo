@echo off
setlocal
set "DIR=%~dp0"
if exist "%DIR%..\.maven\apache-maven-3.9.9\bin\mvn.cmd" (
    call "%DIR%..\.maven\apache-maven-3.9.9\bin\mvn.cmd" %*
) else (
    call mvn %*
)
endlocal
