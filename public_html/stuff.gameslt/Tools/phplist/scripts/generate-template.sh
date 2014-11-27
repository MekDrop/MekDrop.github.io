#!/bin/bash

## script to generate the language gettext template.po from the source code

svnup=$3
reportto=$1
current=$2

[ ! -s "$current" ] && [ -f $current ] || {
  echo Usage: $0 [reportto] [currentfile] [optional: do svn-up]
  exit;
}

[ "$reportto" ] || reportto=root@localhost 

if [ "$svnup" ]; then
  svn up
fi

[ -d public_html ] || exit; ## needs to run from phplist root

now=$(date +%Y%m%d%H%M)

## from http://www.lxg.de/code/playing-with-xgettext
echo '' > messages.po # xgettext needs that file, and we need it empty

## the structure.php file has texts that cannot be found this way.
php scripts/structuredump.php > public_html/databasestructure.php

find public_html -type f -iname "*.php" | xgettext --omit-header --keyword=__ --keyword=_e --keyword=s --keyword=get -j -f -
msgmerge -N $current messages.po > phplist-new.pot 2>/dev/null

diff phplist-new.pot $current > diff${now}
fgrep '< msgid' diff${now} | sed s/'< msgid'// > diff2${now}

if [ -s "diff2${now}" ]; then
  exec > /tmp/message$$
  echo These are this weeks changes in the language template file
  echo They will show up in http://translation.phplist.com as untranslated
  echo Please update your translations, thanks 
  echo
  cat diff2${now}

  mail -s "phpList language changes" $reportto < /tmp/message$$ 
  rm -f diff${now} diff2${now} /tmp/message$$
fi
mv -f phplist-new.pot phplist.pot
rm -f messages.po phplist-new.pot diff${now} diff2${now} public_html/databasestructure.php

