"""Editorial PDF renderer. Uses the same issue and article data as the HTML brief."""
import json,pathlib,html
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,KeepTogether,HRFlowable,Table,TableStyle,Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT=pathlib.Path('output/pdf');OUT.mkdir(parents=True,exist_ok=True)
from fontTools.ttLib import TTFont as SourceFont
font_dir=pathlib.Path('tmp/pdf-fonts');font_dir.mkdir(parents=True,exist_ok=True)
for family,package,weight in [('EMBody','dm-sans',400),('EMBold','dm-sans',700),('EMHeading','manrope',700)]:
 source=pathlib.Path(f'node_modules/@fontsource/{package}/files/{package}-latin-{weight}-normal.woff')
 target=font_dir/(family+'.ttf');font=SourceFont(source,recalcTimestamp=False);font.flavor=None;font.save(target);pdfmetrics.registerFont(TTFont(family,str(target)))
pdfmetrics.registerFontFamily('EMBody',normal='EMBody',bold='EMBold',italic='EMBody',boldItalic='EMBold')
GREEN=colors.HexColor('#345a43');INK=colors.HexColor('#24372d');MUTED=colors.HexColor('#617166');LINE=colors.HexColor('#dde5d6');MINT=colors.HexColor('#f0f5eb');WARM=colors.HexColor('#f8f6f0')
styles={
 'title':ParagraphStyle('title',fontName='EMHeading',fontSize=27,leading=33,textColor=INK,spaceAfter=11),
 'date':ParagraphStyle('date',fontName='EMBody',fontSize=11,leading=17,textColor=GREEN,spaceAfter=16),
 'section':ParagraphStyle('section',fontName='EMBold',fontSize=9,leading=14,textColor=GREEN,spaceBefore=20,spaceAfter=10,keepWithNext=True),
 'entry':ParagraphStyle('entry',fontName='EMHeading',fontSize=17,leading=23,textColor=INK,spaceAfter=9,keepWithNext=True),
 'body':ParagraphStyle('body',fontName='EMBody',fontSize=10.5,leading=16.5,textColor=INK,spaceAfter=10),
 'label':ParagraphStyle('label',fontName='EMBold',fontSize=9,leading=14,textColor=GREEN,spaceAfter=6,keepWithNext=True),
 'small':ParagraphStyle('small',fontName='EMBody',fontSize=8.5,leading=13,textColor=MUTED,spaceAfter=8),
 'tiny':ParagraphStyle('tiny',fontName='EMBody',fontSize=7.5,leading=11,textColor=MUTED,spaceAfter=0),
 'takeaway':ParagraphStyle('takeaway',fontName='EMBody',fontSize=10.5,leading=17,textColor=INK,spaceAfter=7),
}
def esc(s):return html.escape(str(s)).replace('–','-').replace('—','-').replace('‑','-')
def p(s,style='body'):return Paragraph(s,styles[style])
def card(content,width=520,bg=MINT,pad=15):
 t=Table([[content]],colWidths=[width],cornerRadii=[7,7,7,7]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),bg),('LEFTPADDING',(0,0),(-1,-1),pad),('RIGHTPADDING',(0,0),(-1,-1),pad),('TOPPADDING',(0,0),(-1,-1),pad),('BOTTOMPADDING',(0,0),(-1,-1),pad)]));return t

def page_frame(canvas,doc):
 canvas.saveState();w,h=letter
 canvas.setFillColor(GREEN);canvas.roundRect(46,h-51,22,22,6,fill=1,stroke=0)
 canvas.setStrokeColor(colors.white);canvas.setLineWidth(1);path=canvas.beginPath();path.moveTo(49,h-40);path.lineTo(54,h-40);path.lineTo(57,h-34);path.lineTo(61,h-47);path.lineTo(64,h-40);path.lineTo(66,h-40);canvas.drawPath(path)
 canvas.setFillColor(GREEN);canvas.setFont('EMBold',12);canvas.drawString(77,h-45,'EM Weekly.')
 canvas.setFillColor(MUTED);canvas.setFont('EMBody',7);canvas.drawRightString(w-46,h-43,'EVIDENCE FOR THE EVERYDAY ED')
 canvas.setStrokeColor(LINE);canvas.line(46,h-64,w-46,h-64)
 canvas.line(46,43,w-46,43);canvas.setFont('EMBody',7);canvas.setFillColor(MUTED);canvas.drawString(46,52,'For professional education. Read the primary source and apply clinical judgment.');canvas.drawString(46,29,'EM WEEKLY  /  AI-generated · Not yet human-reviewed');canvas.drawRightString(w-46,29,f'{doc.page:02d}');canvas.restoreState()

for file in sorted(pathlib.Path('content/issues').glob('*.json')):
 i=json.loads(file.read_text());date_label=i['title'].split(' - ',1)[-1]
 story=[p('Emergency Medicine<br/>Literature Brief','title'),p(esc(date_label)+' &nbsp; / &nbsp; <b>Coverage:</b> '+esc(i['coverageStart'])+' to '+esc(i['coverageEnd']),'date')]
 if i['sample']:story.append(p('<b>HISTORICAL SAMPLE</b> &nbsp; This issue demonstrates the format; it is not current weekly coverage.','tiny'));story.append(Spacer(1,13))
 else:story.extend([p(esc(i['overview']),'small'),Spacer(1,6)])
 takeaways=[p('CLINICAL TAKEAWAYS','label')]+[p('• &nbsp;'+esc(t),'takeaway') for t in i['clinicalTakeaways']]
 story.append(card(takeaways));story.append(Spacer(1,4))
 for section in i.get('sectionOrder',['Practice-Changing / High Priority','Guidelines & Statements','Worth Knowing','Watch List']):
  items=[x for x in i['items'] if x['section']==section]
  if not items:continue
  story.append(p(esc(section).upper(),'section'));story.append(HRFlowable(width='100%',color=LINE,thickness=.6));story.append(Spacer(1,13))
  for index,item in enumerate(items):
   a=json.loads(pathlib.Path('content/articles',item['articleId']+'.json').read_text())
   if item['catchUp']:story.append(p('Catch-up: previously missed important publication','small'))
   story.extend([p(esc(a['title']),'entry'),p(esc(a['source'])+' &nbsp; / &nbsp; First online '+esc(a['firstOnlineDate']),'small'),Spacer(1,3),p('Summary','label'),p(esc(a['summary']))])
   boxes=[]
   for label,key in [('Why it matters','whyItMatters'),('Limitations','limitations')]:boxes.append([p(label,'label'),p(esc(a[key]),'body')])
   box=Table([[card(boxes[0],253,MINT,13),'',card(boxes[1],253,WARM,13)]],colWidths=[253,14,253]);box.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]));story.extend([Spacer(1,4),box,Spacer(1,16)])
   link='https://doi.org/'+a['doi'] if a['doi'] else a['canonicalUrl']
   story.append(p('<b>Source:</b> <link href="'+esc(link)+'" color="#345a43">'+esc(a['doi'] or link)+'</link> &nbsp; · &nbsp; <b>Full text:</b> <link href="'+esc(a['canonicalUrl'])+'" color="#345a43">'+esc(a['fullTextStatus'])+'</link>','small'))
   story.append(p(esc(a['evidenceNotes'])+' AI-generated; '+esc(a['humanReview'])+'.','tiny'));story.append(Spacer(1,15))
 if i['otherUpdates']:
  story.append(p('Other notable updates','section'))
  for update in i['otherUpdates']:story.append(p(esc(update)))
 # Professional-use note lives in the page footer to prevent an orphan disclaimer page.
 target=OUT/(i['id']+'.pdf');doc=SimpleDocTemplate(str(target),pagesize=letter,rightMargin=46,leftMargin=46,topMargin=88,bottomMargin=60,title=i['title'],author='EM Weekly',pageCompression=1,invariant=1);doc.build(story,onFirstPage=page_frame,onLaterPages=page_frame);print(target)
