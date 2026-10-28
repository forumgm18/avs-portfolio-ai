#!/usr/bin/env bash
# Готовит медиа для сайта из исходников в «Кейсы/» и «Курсы/» (в git не идут).
# PNG → WebP (полный размер + превью), webm → mp4 + постер, копия PDF и md.
# Персональные данные на скринах замазываются здесь же (blur по координатам).
# Запуск из корня сайта: bash tools/build-media.sh
set -euo pipefail

SRC="Кейсы"
OUT="cases"
FULL_W=1600   # макс. ширина полного скрина
WIDE_W=2400   # схемы n8n широкие — оставляем крупнее
THUMB_W=640

# webp <src.png> <dst-без-расширения> [макс.ширина] [blur-регион WxH+X+Y ...]
webp() {
  local src="$1" dst="$2" max="${3:-$FULL_W}"
  shift 3 || shift $#
  local blur=()
  for region in "$@"; do
    blur+=(-region "$region" -blur 0x14 +region)
  done
  mkdir -p "$(dirname "$dst")"
  magick "$src" "${blur[@]}" -resize "${max}x>" -quality 82 "$dst.webp"
  magick "$dst.webp" -resize "${THUMB_W}x>" -quality 75 "$dst-thumb.webp"
  echo "  $dst.webp"
}

echo "sales-analytics"
D="$SRC/AI-аналитик продаж для руководителя отдела"; O="$OUT/sales-analytics"
webp "$D/n8n_Morning_Report__Workflow.png" "$O/workflow" "$WIDE_W"
for n in B1 B2 B3 B4 B5 B6 B7 B8 B9 B10; do
  webp "$D/tg_$n.png" "$O/tg-${n,,}" "$FULL_W"
done
webp "$D/tg_Append_File.png" "$O/tg-file" "$FULL_W"
webp "$D/tg_access_error.png" "$O/tg-access-error" "$FULL_W"
webp "$D/tg_Morning_Report.png" "$O/tg-morning-report" "$FULL_W"

echo "ai-seller"
D="$SRC/AI-агент продавец"; O="$OUT/ai-seller"
webp "$D/wf.png" "$O/workflow" "$WIDE_W"
webp "$D/Tg_all.png" "$O/tg-dialog" "$FULL_W"

echo "docs-agent"
D="$SRC/Мультиагентный генератор КП и договоров (docs-agent)"; O="$OUT/docs-agent"
webp "$D/tg_complect_ooo-vector.png" "$O/tg-komplekt" "$FULL_W"
webp "$D/tg_dogovor.png" "$O/tg-dogovor" "$FULL_W"
webp "$D/tg_help.png" "$O/tg-help" "$FULL_W"
webp "$D/tg_source.png" "$O/tg-sources" "$FULL_W"
cp "$D/KP_ooo_vektor_2026-10-06.pdf" "$O/kp-ooo-vektor.pdf"
cp "$D/Dogovor_ooo_vektor_2026-10-06.pdf" "$O/dogovor-ooo-vektor.pdf"
magick -density 110 "$O/kp-ooo-vektor.pdf[0]" -background white -alpha remove -quality 80 "$O/kp-cover.webp"
magick -density 110 "$O/dogovor-ooo-vektor.pdf[0]" -background white -alpha remove -quality 80 "$O/dogovor-cover.webp"

echo "content-factory"
D="$SRC/AI контент-завод. анализ конкурента и посты с изображениями"; O="$OUT/content-factory"
webp "$D/workflow.png" "$O/workflow" "$WIDE_W"
for n in 01 02 03; do
  webp "$D/tg$n.png" "$O/post-$n" "$FULL_W"
done

echo "avatar-video"
D="$SRC/Пайплайн вертикальных видео с AI-аватаром"; O="$OUT/avatar-video"
webp "$D/00_Workflow.png" "$O/workflow" "$WIDE_W"
webp "$D/Webform_Create_Avatar-Voice.png" "$O/form-avatar" "$FULL_W"
# личный e-mail в поле формы
webp "$D/Webform_Create_Video.png" "$O/form-video" "$FULL_W" "400x55+265+1073"
ffmpeg -loglevel error -y -i "$D/P1___Video.webm" -c:v libx264 -crf 24 -preset slow \
  -vf "scale=720:-2" -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart "$O/video.mp4"
ffmpeg -loglevel error -y -ss 1 -i "$D/P1___Video.webm" -frames:v 1 -vf "scale=720:-2" "$O/poster.png"
magick "$O/poster.png" -quality 80 "$O/poster.webp" && rm "$O/poster.png"

echo "ai-seller-crm"
D="$SRC/AI-агент продавец с Интеграция с CRM"; O="$OUT/ai-seller-crm"
webp "$D/worlflow.png" "$O/workflow" "$WIDE_W"
webp "$D/wf-create_lead_amoCRM.png" "$O/workflow-create-lead" "$WIDE_W"
for n in 1 2 3 4 5 6 7 8; do
  webp "$D/c$n.png" "$O/c$n-chat" "$FULL_W"
done
webp "$D/c6_warning.png" "$O/c6-manager" "$FULL_W"
# домен self-hosted n8n в журнале событий amoCRM
webp "$D/c1_amoCRM.png" "$O/c1-crm" "$WIDE_W" "150x84+1628+264"
webp "$D/c2_amoCRM.png" "$O/c2-crm" "$WIDE_W" "150x84+1638+279"
webp "$D/c3_amoCRM.png" "$O/c3-crm" "$WIDE_W"
webp "$D/c4_amoCRM.png" "$O/c4-crm" "$WIDE_W" "150x86+1550+264"
webp "$D/c5_amoCRM.png" "$O/c5-crm" "$WIDE_W"
webp "$D/c7_amoCRM.png" "$O/c7-crm" "$WIDE_W" "150x86+1550+415"

echo "speech-to-text"
D=$(echo "$SRC/Транскрибатор видео и аудио в конспект (speech-to-text)"/*/); O="$OUT/speech-to-text"
mkdir -p "$O/frames"
cp "$D"*"(конспект).md" "$O/konspekt.md"
cp "$D"*"(таймкоды).md" "$O/timecodes.md"
# в «визуале» оставляем только кадры, на которые он ссылается
sed 's/frames\/\(frame_[0-9_]*\)\.png/frames\/\1.webp/g' "$D"*"(визуал).md" > "$O/visual.md"
grep -o 'frame_[0-9_]*\.png' "$D"*"(визуал).md" | sort -u | while read -r f; do
  magick "$D/frames/$f" -resize "${FULL_W}x>" -quality 80 "$O/frames/${f%.png}.webp"
  magick "$O/frames/${f%.png}.webp" -resize "${THUMB_W}x>" -quality 75 "$O/frames/${f%.png}-thumb.webp"
  echo "  $O/frames/${f%.png}.webp"
done

echo "certificates"
# папка в «Курсы/» → slug направления на сайте; новое направление — новая строка
declare -A CERT_DIRS=([Js]=js)
for dir in "${!CERT_DIRS[@]}"; do
  for f in "Курсы/$dir"/*.{jpg,jpeg,png}; do
    [ -e "$f" ] || continue
    name=$(basename "${f%.*}")
    webp "$f" "certificates/${CERT_DIRS[$dir]}/$name" "$FULL_W"
  done
done

echo "done"
du -sh "$OUT" certificates
