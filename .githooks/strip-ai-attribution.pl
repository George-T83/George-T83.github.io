#!/usr/bin/env perl
# Node-free port of scripts/attributionPatterns.js's stripAiAttribution().
# Same patterns, same intent: rewrites the commit message file in place,
# removing any AI attribution before the commit is created. Kept here
# (rather than in scripts/) so this repo never needs Node installed just
# to enforce this - see .githooks/commit-msg.
use strict;
use warnings;
use utf8;
binmode(STDOUT, ':encoding(UTF-8)');

my $file = shift @ARGV or die "Usage: strip-ai-attribution.pl <commit-msg-file>\n";
open(my $fh, '<:encoding(UTF-8)', $file) or die "Cannot open $file: $!";
local $/;
my $text = <$fh>;
close $fh;
my $original = $text;

# "---\n_Generated with/by [Claude Code](...)_ " style footer blocks.
$text =~ s/\n{0,2}-{3,}\s*\n+\s*(?:\x{1F916}\s*)?_{0,2}\**\s*Generated (?:with|by)\s*(?:\[?Claude Code\]?)[^\n]*\n?//gi;

# Any remaining stray "Generated with/by Claude Code" line.
$text =~ s/^\s*(?:\x{1F916}\s*)?_{0,2}\**\s*Generated (?:with|by)\s*\[?Claude Code\]?.*$//gim;

# Co-Authored-By trailers.
$text =~ s/^Co-Authored-By:.*$//gim;

# Claude-Session trailers / bare claude.ai session links.
$text =~ s/^\s*(?:Claude-Session:\s*)?https:\/\/claude\.ai\/\S*\s*$//gim;

# Collapse a divider rule left dangling with nothing after it, and any
# run of 3+ blank lines the removals above left behind.
$text =~ s/\n{0,2}-{3,}\s*$//;
$text =~ s/\n{3,}/\n\n/g;

$text =~ s/^\s+//;
$text =~ s/\s+$//;
$text .= "\n" if length($text) > 0;

if ($text ne $original) {
  open(my $out, '>:encoding(UTF-8)', $file) or die "Cannot write $file: $!";
  print $out $text;
  close $out;
  print "[strip-ai-attribution] Removed AI attribution from commit message.\n";
}
