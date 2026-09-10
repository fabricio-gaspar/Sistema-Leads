-- Curadoria do conteúdo público solicitado pelo responsável da Wayflex em 2026-09-10.
-- A fonte é sempre a página oficial indicada em source_url. Nenhuma especificação,
-- disponibilidade, certificado, preço ou prazo é convertido em promessa automática.

begin;

update public.knowledge_chunks chunks
set status = 'draft',
    metadata = coalesce(chunks.metadata, '{}'::jsonb) || jsonb_build_object(
      'superseded_by', 'wayflex_public_catalog_v2_2026_09_10'
    )
from public.documents documents
where chunks.document_id = documents.id
  and chunks.organization_id = 'a1ea4d91-3d09-4052-9759-3009b442e6cb'::uuid
  and documents.organization_id = chunks.organization_id
  and documents.metadata ->> 'memory_version' = 'wayflex_memory_v1_2026_09_04'
  and chunks.status = 'active';

update public.documents
set status = 'draft',
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'superseded_by', 'wayflex_public_catalog_v2_2026_09_10'
    )
where organization_id = 'a1ea4d91-3d09-4052-9759-3009b442e6cb'::uuid
  and metadata ->> 'memory_version' = 'wayflex_memory_v1_2026_09_04'
  and status = 'active';

with target as (
  select id as organization_id
  from public.organizations
  where id = 'a1ea4d91-3d09-4052-9759-3009b442e6cb'::uuid
), memory_entries (source_key, name, content_text, memory_category, keywords, source_url, image_alt) as (
  values
    (
      'source-policy',
      'Wayflex: escopo e fonte oficial da Base da Ana',
      $memory$Esta base reúne resumos do conteúdo público da Wayflex revisados em 10/09/2026. As páginas oficiais são a referência para apresentação de famílias, aplicações e contatos. A Ana pode orientar sobre o escopo publicado e compartilhar a página-fonte, mas não deve transformar o conteúdo em garantia técnica, comercial ou de disponibilidade. Se a página não responder à necessidade, deve coletar os dados técnicos e encaminhar para a equipe.$memory$,
      'regras_comerciais',
      array['fonte oficial','site oficial','catálogo','segmento','acessório','confirmação técnica','Wayflex']::text[],
      'https://wayflex.ind.br/',
      null
    ),
    (
      'institutional-contact',
      'Wayflex: apresentação institucional e contato público',
      $memory$A Wayflex apresenta-se como empresa brasileira especializada no desenvolvimento e fabricação de soluções industriais em borracha, silicone e poliuretano (PU). O site informa atendimento a empresas e indústrias, com peças técnicas e soluções conforme a aplicação. Canais públicos informados: telefone/WhatsApp (11) 93288-4074, contato@wayflex.ind.br e Rua Luiz Fornaziero, 134, Jardim do Paço, Sorocaba - SP, 18087-094. Horário informado: segunda a sexta, 8h às 18h. Antes de confirmar atendimento, disponibilidade ou retorno, a Ana deve encaminhar a solicitação à equipe.$memory$,
      'institucional',
      array['empresa','Wayflex','contato','WhatsApp','telefone','e-mail','Sorocaba','horário']::text[],
      'https://wayflex.ind.br/contato',
      null
    ),
    (
      'materials-and-development',
      'Wayflex: materiais e desenvolvimento sob medida',
      $memory$O site informa atuação com borracha natural e sintética, silicone, poliuretano e outros elastômeros técnicos, com peças sob medida conforme desenho, amostra ou especificação. A escolha do material depende da aplicação e das condições de uso. A Ana pode pedir aplicação, temperatura, contato com óleo, água ou produto químico, abrasão, medidas, desenho/amostra e quantidade. Ela não pode confirmar composição, atoxicidade, dureza, compatibilidade, resistência ou certificação sem análise técnica.$memory$,
      'materiais',
      array['borracha','silicone','poliuretano','PU','elastômero','sob medida','desenho','amostra','especificação']::text[],
      'https://wayflex.ind.br/',
      null
    ),
    (
      'catalog-navigation',
      'Wayflex: como orientar pelos catálogos oficiais',
      $memory$Os catálogos oficiais apresentam aplicações industriais, não uma tabela de preço, estoque ou ficha técnica completa. Quando o interesse corresponder a um catálogo, a Ana pode indicar a aplicação publicada e a página https://wayflex.ind.br/catalogos. Para dar sequência, deve perguntar uma informação por vez: peça ou equipamento, ambiente de uso, medida/perfil ou desenho/amostra, material/requisito, quantidade e prazo desejado. A confirmação de viabilidade é humana/técnica.$memory$,
      'solucoes_e_produtos',
      array['catálogo','aplicação','produto','solução','orçamento','desenho','amostra','medida']::text[],
      'https://wayflex.ind.br/catalogos',
      'Catálogos oficiais da Wayflex'
    ),
    (
      'qualification-flow',
      'Wayflex: qualificação segura para peças e acessórios',
      $memory$Para uma demanda de peça, catálogo ou acessório, a Ana deve qualificar gradualmente: primeiro a aplicação, equipamento ou problema; depois medida, perfil, foto, desenho ou amostra; então condição de uso e material atual/requisito; em seguida quantidade/lote, prazo desejado, cidade, empresa e responsável. Deve fazer apenas uma pergunta por mensagem. Ao receber desenho, foto ou amostra, registra a informação e pede somente o próximo dado necessário; não interpreta a especificação como aprovada.$memory$,
      'qualificacao',
      array['qualificação','aplicação','equipamento','medida','perfil','foto','desenho','amostra','quantidade','lote']::text[],
      'https://wayflex.ind.br/',
      null
    ),
    (
      'commercial-limits',
      'Wayflex: limites de resposta comercial e técnica',
      $memory$A Ana não pode informar ou garantir preço, desconto, estoque, prazo de fabricação ou entrega, frete, pedido mínimo, certificação, laudo, dimensão, dureza, composição, atoxicidade, resistência ou compatibilidade. O site cita prazos e certificações em alguns conteúdos, mas essas são informações públicas sujeitas a confirmação comercial/técnica; não são compromisso automático. Para orçamento ou condição comercial, a Ana coleta os dados mínimos e faz handoff para a equipe.$memory$,
      'regras_comerciais',
      array['preço','valor','orçamento','prazo','estoque','frete','certificação','laudo','compatibilidade','handoff']::text[],
      'https://wayflex.ind.br/',
      null
    ),
    (
      'approved-answer-catalog',
      'Wayflex: resposta aprovada para catálogo, segmento ou acessório',
      $memory$Resposta aprovada: “A Wayflex trabalha com soluções técnicas industriais em borracha, silicone e poliuretano. Posso verificar qual família publicada se aproxima da sua aplicação e direcionar a análise da equipe. Qual peça, equipamento ou problema você precisa atender?” Se o lead já nomear uma aplicação, responder de forma objetiva com a família publicada, sem prometer desempenho, e pedir a próxima informação técnica que faltar.$memory$,
      'respostas_aprovadas',
      array['resposta aprovada','catálogo','segmento','acessório','aplicação','peça','equipamento']::text[],
      'https://wayflex.ind.br/catalogos',
      null
    ),
    (
      'handoff-policy',
      'Wayflex: quando a Ana deve transferir para uma pessoa',
      $memory$A Ana deve fazer handoff imediato se o contato pedir atendimento humano, enviar reclamação, mencionar garantia, negociação, valor, prazo, frete, estoque, certificação, laudo, risco jurídico ou uma especificação não confirmada. O handoff deve registrar a aplicação, o dado já informado, o motivo da transferência e a próxima ação. Ela também transfere quando uma imagem, desenho ou solicitação técnica não puder ser confirmada pela Base aprovada.$memory$,
      'handoff_humano',
      array['humano','atendente','reclamação','garantia','negociação','preço','prazo','certificação','jurídico']::text[],
      'https://wayflex.ind.br/contato',
      null
    ),

    (
      'catalog-bau-caminhao',
      'Catálogo Wayflex: vedação para baú e caminhão',
      $memory$O catálogo apresenta vedações para baú de carga seca, portas frigoríficas, sider e roll-up. A Ana pode identificar essa família para aplicações de baú e caminhão e pedir o tipo de porta, perfil/medida, condição de uso e quantidade antes de encaminhar a análise.$memory$,
      'solucoes_e_produtos',
      array['baú','caminhão','carga seca','porta frigorífica','sider','roll-up','vedação']::text[],
      'https://wayflex.ind.br/catalogos',
      'Vedação para Baú e Caminhão'
    ),
    (
      'catalog-energia-fotovoltaica',
      'Catálogo Wayflex: energia solar fotovoltaica',
      $memory$O catálogo apresenta soluções de vedação para painéis fotovoltaicos e sistemas solares. A Ana deve pedir o tipo de painel ou instalação, perfil/medida, ambiente externo e quantidade; não deve afirmar desempenho, vedação ou compatibilidade sem validação técnica.$memory$,
      'solucoes_e_produtos',
      array['energia solar','fotovoltaica','painel solar','FV','vedação','perfil']::text[],
      'https://wayflex.ind.br/catalogos',
      'Energia Solar Fotovoltaica'
    ),
    (
      'catalog-guarnicoes-epdm',
      'Catálogo Wayflex: guarnições em borracha EPDM',
      $memory$O catálogo apresenta guarnições em borracha EPDM para esquadrias e aplicações de uso interno ou externo. A Ana deve identificar o tipo de esquadria e solicitar seção do perfil, medidas, ambiente e quantidade. A indicação do composto e da compatibilidade depende de confirmação técnica.$memory$,
      'solucoes_e_produtos',
      array['EPDM','guarnição','esquadria','perfil','alumínio','PVC','uso externo','vedação']::text[],
      'https://wayflex.ind.br/catalogos',
      'Guarnições em Borracha EPDM'
    ),
    (
      'catalog-compactadores',
      'Catálogo Wayflex: compactadores de lixo',
      $memory$O catálogo apresenta soluções de vedação para compactadores de lixo e equipamentos de coleta. A Ana pode direcionar a demanda para essa aplicação e pedir modelo do equipamento, perfil ou medida, condição de desgaste e quantidade.$memory$,
      'solucoes_e_produtos',
      array['compactador','lixo','coleta','vedação','equipamento']::text[],
      'https://wayflex.ind.br/catalogos',
      'Compactadores de Lixo'
    ),
    (
      'catalog-lanternas-farois',
      'Catálogo Wayflex: perfis para lanternas e faróis',
      $memory$O catálogo apresenta perfis de borracha para lanternas e faróis, incluindo perfis esponjosos e componentes automotivos. A Ana deve pedir o conjunto, perfil/medida ou desenho, condição de uso e lote para a equipe avaliar a solução.$memory$,
      'solucoes_e_produtos',
      array['lanterna','farol','luminária','automotivo','perfil esponjoso','vedação']::text[],
      'https://wayflex.ind.br/catalogos',
      'Perfil de Borracha para Lanternas e Faróis'
    ),
    (
      'catalog-hidreletricas',
      'Catálogo Wayflex: hidrelétricas e comportas',
      $memory$O catálogo apresenta perfis para vedações de comportas e aplicações hidráulicas especiais em hidrelétricas. A Ana deve pedir o tipo de comporta, perfil/desenho, meio de contato, pressão ou condição operacional e quantidade, sempre com avaliação técnica antes de confirmar material.$memory$,
      'solucoes_e_produtos',
      array['hidrelétrica','comporta','hidráulica','perfil nota musical','vedação','energia']::text[],
      'https://wayflex.ind.br/catalogos',
      'Hidrelétricas'
    ),
    (
      'catalog-quadro-comando',
      'Catálogo Wayflex: vedação para quadro de comando',
      $memory$O catálogo apresenta perfil de vedação para quadro de comando. A Ana pode identificar a família e pedir dimensões do rasgo/perfil, ambiente de instalação, necessidade declarada pelo cliente e quantidade; não deve garantir aderência, resistência ou grau de proteção.$memory$,
      'solucoes_e_produtos',
      array['quadro de comando','painel','perfil','vedação','elétrica']::text[],
      'https://wayflex.ind.br/catalogos',
      'Perfil de Vedação para Quadro de Comando'
    ),
    (
      'catalog-mineracao',
      'Catálogo Wayflex: soluções para mineração',
      $memory$O catálogo apresenta soluções em borracha e PU para mineração, incluindo aplicações em britadores, peneiras e revestimentos. Entre as referências visuais estão anéis e coxins de PU para britadores cônicos, lençóis de borracha para desgaste por abrasão e perfil U para longarinas de peneiras. A Ana deve pedir equipamento, posição da peça, abrasão/impacto, desenho ou medida e quantidade.$memory$,
      'solucoes_e_produtos',
      array['mineração','britador','peneira','PU','poliuretano','anel','coxim','lençol','abrasão','perfil U']::text[],
      'https://wayflex.ind.br/catalogos',
      'Soluções para Indústria de Mineração'
    ),
    (
      'catalog-silicone',
      'Catálogo Wayflex: borracha de silicone',
      $memory$O catálogo apresenta perfis e vedações em borracha de silicone para aplicações de altas e baixas temperaturas. A Ana deve pedir a aplicação, faixa de temperatura declarada pelo cliente, perfil/medida, desenho ou amostra e quantidade. Ela não deve confirmar atoxicidade, norma sanitária ou compatibilidade sem laudo técnico.$memory$,
      'materiais',
      array['silicone','alta temperatura','baixa temperatura','perfil','vedação','forno','estufa']::text[],
      'https://wayflex.ind.br/catalogos',
      'Borracha de Silicone'
    ),
    (
      'catalog-pontes-viadutos',
      'Catálogo Wayflex: pontes e viadutos',
      $memory$O catálogo apresenta juntas de dilatação e perfis técnicos para pontes e viadutos. A Ana deve direcionar a demanda para análise técnica e coletar tipo de estrutura, local de aplicação, desenho/seção, movimento esperado informado pelo cliente e quantidade; não pode indicar solução estrutural ou desempenho.$memory$,
      'solucoes_e_produtos',
      array['ponte','viaduto','junta de dilatação','infraestrutura','perfil','construção civil']::text[],
      'https://wayflex.ind.br/catalogos',
      'Pontes e Viadutos'
    ),
    (
      'catalog-pre-moldados',
      'Catálogo Wayflex: formas de pré-moldados',
      $memory$O catálogo apresenta perfis de borracha para formas de pré-moldados, associados a cantos vivos de pilares, vigas, escadas e outras estruturas pré-moldadas. A Ana deve pedir a peça/formato, seção do perfil, desenho ou medida, quantidade e prazo desejado.$memory$,
      'solucoes_e_produtos',
      array['pré-moldado','forma','pilar','viga','escada','perfil de borracha','construção']::text[],
      'https://wayflex.ind.br/catalogos',
      'Perfil de Borracha para Formas de Pré-Moldados'
    ),
    (
      'catalog-porta-container',
      'Catálogo Wayflex: vedação para porta de container',
      $memory$O catálogo apresenta perfis de borracha para vedação de porta de container e diferentes perfis técnicos. A Ana deve solicitar tipo de container, porta, perfil ou medida, condição de uso e quantidade, sem prometer compatibilidade com um modelo específico antes da validação.$memory$,
      'solucoes_e_produtos',
      array['container','porta de container','perfil','guarnição','gaxeta','vedação']::text[],
      'https://wayflex.ind.br/catalogos',
      'Perfil de Borracha para Porta de Container'
    ),
    (
      'catalog-refrigeracao',
      'Catálogo Wayflex: refrigeração comercial',
      $memory$O catálogo apresenta perfis, guarnições e tubos para refrigeração comercial. A Ana pode orientar pela família e pedir equipamento, tipo de porta ou conjunto, perfil/medida, temperatura de trabalho declarada, ambiente e quantidade. Qualquer propriedade de chama, umidade ou desempenho precisa de confirmação técnica.$memory$,
      'solucoes_e_produtos',
      array['refrigeração','guarnição','tubo','perfil','porta frigorífica','câmara fria']::text[],
      'https://wayflex.ind.br/catalogos',
      'Refrigeração Comercial'
    ),
    (
      'catalog-fornos',
      'Catálogo Wayflex: vedação para portas de fornos industriais',
      $memory$O catálogo apresenta soluções em silicone para vedação de portas de fornos industriais, estufas e seladoras. A Ana deve pedir equipamento, faixa de temperatura declarada, perfil/medida ou amostra, condição de uso e quantidade. A adequação do silicone à aplicação deve ser confirmada pela equipe técnica.$memory$,
      'solucoes_e_produtos',
      array['forno','estufa','seladora','porta de forno','silicone','alta temperatura','vedação']::text[],
      'https://wayflex.ind.br/catalogos',
      'Vedação para Portas de Fornos Industriais'
    ),
    (
      'catalog-transformadores',
      'Catálogo Wayflex: perfis, arruelas e cordões para transformadores',
      $memory$O catálogo apresenta perfis, arruelas e cordões nitrílicos para transformadores. A Ana deve pedir equipamento, peça, desenho ou medida, contato com óleo ou outra condição declarada pelo cliente e quantidade. Não deve garantir resistência a óleo isolante, vedação ou certificação sem validação técnica.$memory$,
      'materiais',
      array['transformador','nitrílica','NBR','arruela','cordão','perfil','óleo isolante','vedação']::text[],
      'https://wayflex.ind.br/catalogos',
      'Perfis, Arruelas e Cordões Nitrílica para Transformadores'
    ),
    (
      'catalog-aquecedor-solar',
      'Catálogo Wayflex: aquecedor solar térmico',
      $memory$O catálogo apresenta aplicações em aquecedor solar térmico, incluindo coletores, mantas de absorção e mangueiras em EPDM. A Ana deve pedir o sistema, medida/perfil, ambiente de instalação, temperatura declarada e quantidade antes de encaminhar a avaliação.$memory$,
      'solucoes_e_produtos',
      array['aquecedor solar','solar térmico','coletor','manta','mangueira','EPDM','energia']::text[],
      'https://wayflex.ind.br/catalogos',
      'Aquecedor Solar Térmico'
    ),
    (
      'catalog-cinta-tanque',
      'Catálogo Wayflex: cinta de borracha para tanque de combustível',
      $memory$O catálogo apresenta cinta de borracha para tanque de combustível, com referências a opções nitrílicas ou EPDM em tamanhos e formatos diversos. A Ana deve coletar tipo de tanque, medidas ou desenho, condição de contato e quantidade. A escolha do material, dimensão e compatibilidade exige confirmação técnica.$memory$,
      'solucoes_e_produtos',
      array['cinta','tanque de combustível','nitrílica','EPDM','combustível','automotivo']::text[],
      'https://wayflex.ind.br/catalogos',
      'Cinta de Borracha para Tanque de Combustível'
    ),

    (
      'segment-automotivo-diversos',
      'Segmento Wayflex: automotivo diversos',
      $memory$A página de segmentos inclui aplicações automotivas diversas com peças técnicas em borracha e PU. A Ana deve identificar o veículo/equipamento, a peça, desenho ou medida, condição de uso e lote; não deve indicar material ou peça equivalente sem confirmação.$memory$,
      'solucoes_e_produtos',
      array['automotivo','veículo','borracha','PU','peça técnica']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-automotivo-leve',
      'Segmento Wayflex: automotivo linha leve',
      $memory$A página de segmentos inclui aplicações para automóveis de passeio e utilitários. A Ana deve pedir veículo/conjunto, peça, referência, perfil ou medida e quantidade antes de encaminhar a consulta técnica.$memory$,
      'solucoes_e_produtos',
      array['automotivo leve','carro','passeio','utilitário','veículo','peça']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-automotivo-pesado',
      'Segmento Wayflex: automotivo linha pesada',
      $memory$A página de segmentos inclui aplicações para linha pesada, como caminhões e ônibus. A Ana deve pedir modelo/conjunto, peça, perfil ou desenho, condição de trabalho e lote antes da avaliação.$memory$,
      'solucoes_e_produtos',
      array['linha pesada','caminhão','ônibus','automotivo','peça técnica']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-caixilharia',
      'Segmento Wayflex: caixilharia e esquadrias',
      $memory$A página de segmentos inclui caixilharia e esquadrias, com referências a perfis e gaxetas para alumínio, PVC e madeira, guarnições EPDM/PVC, fitas, escovas vedadoras, Tarucel e espumas. A Ana deve pedir material da esquadria, seção do perfil, medidas, uso interno/externo e quantidade.$memory$,
      'solucoes_e_produtos',
      array['caixilharia','esquadria','alumínio','PVC','madeira','EPDM','gaxeta','Tarucel','escova']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-capacete',
      'Segmento Wayflex: capacetes',
      $memory$A página de segmentos inclui componentes em borracha e espuma para capacetes. A Ana deve pedir tipo de capacete, componente, desenho ou amostra, requisito declarado e quantidade; requisitos de segurança ou norma exigem validação humana/técnica.$memory$,
      'solucoes_e_produtos',
      array['capacete','borracha','espuma','componente','segurança']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-cinta-tanque',
      'Segmento Wayflex: cinta para tanque',
      $memory$A página de segmentos inclui cinta para tanque voltada à proteção e fixação. A Ana deve pedir aplicação, tanque, medidas/desenho, condição de contato e quantidade; material e viabilidade devem ser confirmados pela equipe.$memory$,
      'solucoes_e_produtos',
      array['cinta tanque','tanque','combustível','fixação','proteção']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-container',
      'Segmento Wayflex: containers',
      $memory$A página de segmentos inclui vedações e gaxetas para containers marítimos, refrigerados e especiais. A Ana deve pedir tipo de container, porta/conjunto, perfil ou desenho, condição ambiental e quantidade antes da consulta técnica.$memory$,
      'solucoes_e_produtos',
      array['container','marítimo','refrigerado','especial','gaxeta','vedação','porta']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-farois-lanternas',
      'Segmento Wayflex: faróis, lanternas e luminárias',
      $memory$A página de segmentos inclui vedações e componentes técnicos para faróis, lanternas e luminárias. A Ana deve pedir conjunto, peça, perfil/medida ou desenho e quantidade, sem afirmar grau de proteção, vedação ou compatibilidade.$memory$,
      'solucoes_e_produtos',
      array['farol','lanterna','luminária','vedação','automotivo','perfil']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-gas-oleo',
      'Segmento Wayflex: gás e óleo',
      $memory$A página de segmentos inclui peças técnicas para aplicações de gás e óleo. A Ana deve pedir fluido/meio de contato declarado, temperatura ou pressão informada, peça, desenho/medida e quantidade. Não pode afirmar resistência química, pressão ou segurança sem análise técnica.$memory$,
      'solucoes_e_produtos',
      array['gás','óleo','fluido','peça técnica','vedação','compatibilidade química']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-implementos-rodoviarios',
      'Segmento Wayflex: implementos rodoviários',
      $memory$A página de segmentos inclui juntas de dilatação, batentes e perfis para portas de container em implementos rodoviários. A Ana deve pedir implemento, conjunto, perfil/desenho, medida e quantidade antes de direcionar a equipe.$memory$,
      'solucoes_e_produtos',
      array['implemento rodoviário','junta de dilatação','batente','porta de container','perfil']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-construcao-infraestrutura',
      'Segmento Wayflex: construção civil e infraestrutura',
      $memory$A página de segmentos inclui perfis para formas de pré-moldados, juntas de dilatação e batentes para pontes e viadutos. A Ana deve pedir a estrutura, peça/perfil, desenho ou medidas, ambiente e quantidade; qualquer recomendação estrutural precisa de avaliação técnica.$memory$,
      'solucoes_e_produtos',
      array['construção civil','infraestrutura','pré-moldado','ponte','viaduto','junta de dilatação','batente']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-maquinas-equipamentos',
      'Segmento Wayflex: máquinas e equipamentos',
      $memory$A página de segmentos inclui peças sob medida para máquinas e equipamentos. A Ana deve pedir equipamento, função da peça, foto/desenho/medida, condição de uso, material atual se conhecido e quantidade.$memory$,
      'solucoes_e_produtos',
      array['máquina','equipamento','sob medida','peça técnica','desenho','amostra']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-mineracao',
      'Segmento Wayflex: mineração',
      $memory$A página de segmentos inclui aplicações em mineração como anéis e coxins de PU para britadores cônicos, lençóis de borracha para abrasão e perfil U para longarinas de peneiras. A Ana deve coletar equipamento, posição da peça, desgaste/abrasão, perfil ou desenho e quantidade.$memory$,
      'solucoes_e_produtos',
      array['mineração','britador cônico','peneira','PU','anel','coxim','lençol de borracha','abrasão']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-multiuso',
      'Segmento Wayflex: aplicações multiuso',
      $memory$A página de segmentos inclui uma linha versátil para aplicações multiuso. Como a aplicação não é específica, a Ana deve começar pelo equipamento/problema e coletar medida ou desenho, condição de uso, material/requisito e quantidade antes de sugerir uma família.$memory$,
      'solucoes_e_produtos',
      array['multiuso','aplicação industrial','peça','equipamento','sob medida']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-naval',
      'Segmento Wayflex: naval e offshore',
      $memory$A página de segmentos inclui aplicações naval e offshore com peças e vedações. A Ana deve pedir equipamento, posição de uso, meio/ambiente declarado, desenho ou medida e quantidade; não deve afirmar resistência a ambiente marinho, óleo ou pressão sem validação técnica.$memory$,
      'solucoes_e_produtos',
      array['naval','offshore','vedação','peça técnica','marítimo']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-refrigeracao',
      'Segmento Wayflex: refrigeração',
      $memory$A página de segmentos inclui silicone para vedação de portas de fornos, estufas e autoclaves, além de perfis, guarnições, tubos e peças prensadas em refrigeração. A Ana deve pedir equipamento, perfil/medida, temperatura declarada, condição de uso e quantidade; propriedades de chama, absorção ou flexibilidade precisam de confirmação técnica.$memory$,
      'solucoes_e_produtos',
      array['refrigeração','forno','estufa','autoclave','silicone','guarnição','tubo','perfil']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-transformador',
      'Segmento Wayflex: transformadores',
      $memory$A página de segmentos inclui perfis, arruelas e cordões nitrílicos para transformadores, além de perfil esponjoso para quadros. A Ana deve pedir equipamento, peça, desenho/medida, condição de contato e quantidade; não pode garantir resistência a óleo, luz, calor ou isolamento sem confirmação técnica.$memory$,
      'materiais',
      array['transformador','nitrílica','arruela','cordão','perfil esponjoso','quadro','óleo isolante']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),
    (
      'segment-energia',
      'Segmento Wayflex: energia renovável e hidrelétrica',
      $memory$A página de segmentos inclui energia renovável e hidrelétrica, com referências a EPDM para coletores, mantas e mangueiras solares, perfis para painel fotovoltaico e perfil para comportas. A Ana deve pedir sistema, peça/perfil, medidas, ambiente e quantidade; desempenho e compatibilidade dependem de análise técnica.$memory$,
      'solucoes_e_produtos',
      array['energia renovável','hidrelétrica','solar','fotovoltaico','EPDM','coletor','mangueira','comporta']::text[],
      'https://wayflex.ind.br/servicos',
      null
    ),

    (
      'accessory-papelao-grafite',
      'Acessórios Wayflex: papelão hidráulico e placas de grafite',
      $memory$A página de acessórios lista papelão hidráulico e placas de grafite. A Ana pode reconhecer a família e pedir aplicação, fluido/meio, medida/espessura requerida pelo cliente, desenho e quantidade; não deve garantir vedação, pressão, temperatura ou compatibilidade.$memory$,
      'solucoes_e_produtos',
      array['papelão hidráulico','placa de grafite','grafite','junta','vedação']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-plasticos-engenharia',
      'Acessórios Wayflex: usinados em plásticos de engenharia',
      $memory$A página de acessórios lista usinados em plásticos de engenharia. Para orientar a demanda, a Ana deve pedir desenho/medidas, função da peça, ambiente de uso, material atual se conhecido e quantidade. A definição de polímero e tolerâncias é técnica.$memory$,
      'solucoes_e_produtos',
      array['usinados','plástico de engenharia','plástico','peça usinada','desenho','tolerância']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-lencois-placas-borracha',
      'Acessórios Wayflex: lençóis e placas de borracha',
      $memory$A página de acessórios lista lençóis e placas de borracha. A Ana deve pedir aplicação, medida/espessura requerida, condição de abrasão ou contato declarada, material desejado se conhecido e quantidade; não deve confirmar composto ou desempenho sem análise.$memory$,
      'solucoes_e_produtos',
      array['lençol de borracha','placa de borracha','chapa','borracha','abrasão']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-gaxetas',
      'Acessórios Wayflex: gaxetas sintéticas e grafitadas',
      $memory$A página de acessórios lista gaxetas sintéticas e grafitadas. A Ana deve pedir equipamento, ponto de vedação, meio de contato, medida/perfil e quantidade. A seleção de gaxeta e a condição de operação precisam de confirmação técnica.$memory$,
      'solucoes_e_produtos',
      array['gaxeta','sintética','grafitada','vedação','equipamento']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-fita-ptfe',
      'Acessórios Wayflex: fita de PTFE expandido',
      $memory$A página de acessórios lista fita de PTFE expandido autoadesiva. A Ana pode registrar a demanda e pedir a aplicação, superfície, medida/largura desejada, condição de uso e quantidade; desempenho de vedação e compatibilidade dependem de validação.$memory$,
      'solucoes_e_produtos',
      array['PTFE','fita expandida','autoadesiva','fita de vedação','teflon']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-mangueiras',
      'Acessórios Wayflex: mangueiras para ar, água e óleo',
      $memory$A página de acessórios lista mangueiras para ar, água e óleo. A Ana deve pedir fluido, diâmetro/medida, pressão e temperatura declaradas pelo cliente, conexão e quantidade. Ela não pode confirmar compatibilidade, pressão ou material sem equipe técnica.$memory$,
      'solucoes_e_produtos',
      array['mangueira','ar','água','óleo','diâmetro','conexão','fluido']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-componentes-vedacao',
      'Acessórios Wayflex: componentes de vedação e apoio',
      $memory$A página de acessórios lista gaxetas, retentores, O-rings, coxins, raspadores, buchas, ventosas, calços, chevrons, diafragmas e juntas. A Ana deve identificar a família solicitada e pedir aplicação, desenho/medida, meio de contato, condição de uso e quantidade antes de encaminhar a análise.$memory$,
      'solucoes_e_produtos',
      array['retentor','O-ring','anel de vedação','coxim','raspador','bucha','ventosa','chevron','diafragma','junta']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-correias',
      'Acessórios Wayflex: correias industriais',
      $memory$A página de acessórios lista correias múltiplas em V, sincronizadoras, variadoras, de nylon e algodão. A Ana deve pedir equipamento, tipo de correia, medida/código se houver, condição de uso e quantidade; não deve afirmar equivalência, estoque ou especificação.$memory$,
      'solucoes_e_produtos',
      array['correia','correia V','sincronizadora','variadora','nylon','algodão','transmissão']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-juntas-especiais',
      'Acessórios Wayflex: juntas para corrosão, temperatura e pressão',
      $memory$A página de acessórios lista juntas para condições de corrosão, temperatura e pressão. A Ana deve coletar aplicação, meio, temperatura e pressão declaradas, desenho/medida e quantidade. A resistência e a seleção da junta só podem ser confirmadas pela equipe técnica.$memory$,
      'solucoes_e_produtos',
      array['junta','corrosão','temperatura','pressão','vedação','fluido']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-acoplamentos',
      'Acessórios Wayflex: acoplamentos',
      $memory$A página de acessórios lista acoplamentos elásticos, flexíveis, rígidos, de engrenagem, corrente, grade, lâminas, precisão, hidráulicos e magnéticos. A Ana deve pedir equipamento, eixos/conjunto, referência ou desenho, condição de operação e quantidade; dimensionamento e compatibilidade exigem análise técnica.$memory$,
      'solucoes_e_produtos',
      array['acoplamento','elástico','flexível','rígido','engrenagem','corrente','hidráulico','magnético']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-rolamentos',
      'Acessórios Wayflex: rolamentos',
      $memory$A página de acessórios lista rolamentos autocompensadores, axiais, radiais, de esferas, rolos e agulhas. A Ana deve pedir equipamento, código/medida, posição de uso, carga/rotação declaradas se disponíveis e quantidade; não deve indicar equivalência ou especificação sem validação.$memory$,
      'solucoes_e_produtos',
      array['rolamento','autocompensador','axial','radial','esfera','rolo','agulha']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-materiais-vedacao',
      'Acessórios Wayflex: cortiça, velomóide, papelão hidráulico e feltro',
      $memory$A página de acessórios lista cortiça, velomóide, papelão hidráulico e feltro. A Ana deve pedir aplicação, medida/espessura, condição de uso e quantidade; propriedades de isolamento, vedação ou resistência precisam de confirmação técnica.$memory$,
      'solucoes_e_produtos',
      array['cortiça','velomóide','papelão hidráulico','feltro','isolamento','vedação']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-perfis',
      'Acessórios Wayflex: perfis sólidos e esponjosos',
      $memory$A página de acessórios lista perfis sólidos e esponjosos em borracha e silicone. A Ana deve pedir seção do perfil, medidas, aplicação, ambiente/temperatura declarada, desenho ou amostra e quantidade. O composto e a adequação precisam de confirmação técnica.$memory$,
      'solucoes_e_produtos',
      array['perfil','sólido','esponjoso','borracha','silicone','guarnição','seção']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-juntas-expansao',
      'Acessórios Wayflex: juntas de expansão',
      $memory$A página de acessórios lista juntas de expansão em borracha, metálicas, de tecido e PTFE. A Ana deve pedir linha/equipamento, meio de contato, dimensões, movimento ou condição declarada e quantidade; seleção e desempenho requerem avaliação técnica.$memory$,
      'solucoes_e_produtos',
      array['junta de expansão','borracha','metálica','tecido','PTFE','tubulação']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-pu',
      'Acessórios Wayflex: PU em chapas, tarugos e peças',
      $memory$A página de acessórios lista poliuretano em chapas, tarugos e peças. A Ana deve pedir a aplicação, desenho/medidas, condição de abrasão/impacto declarada, material atual se conhecido e quantidade. Não pode confirmar dureza ou resistência sem análise.$memory$,
      'materiais',
      array['PU','poliuretano','chapa','tarugo','peça','abrasão','impacto']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-isolamento',
      'Acessórios Wayflex: PIR, PU e espuma elastomérica',
      $memory$A página de acessórios lista PIR, PU e tubos/mantas de espuma elastomérica. A Ana deve pedir a aplicação, medida, ambiente e requisito técnico declarado pelo cliente; não deve confirmar isolamento, chama, temperatura ou norma sem documentação e validação técnica.$memory$,
      'solucoes_e_produtos',
      array['PIR','PU','espuma elastomérica','tubo','manta','isolamento']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-espumas-adesivas',
      'Acessórios Wayflex: espumas adesivas',
      $memory$A página de acessórios lista espumas adesivas em PE, EPDM, neoprene, PVC e EVA. A Ana deve pedir aplicação, espessura/medida, superfície, ambiente e quantidade. A aderência, o material e a compatibilidade devem ser confirmados pela equipe.$memory$,
      'solucoes_e_produtos',
      array['espuma adesiva','PE','EPDM','neoprene','PVC','EVA','adesivo']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    ),
    (
      'accessory-sedes-valvula',
      'Acessórios Wayflex: sedes de válvula',
      $memory$A página de acessórios lista sedes de válvula. A Ana deve pedir tipo de válvula, desenho/medida, meio de contato, condição operacional declarada e quantidade. Material, vedação, pressão e compatibilidade dependem de análise técnica.$memory$,
      'solucoes_e_produtos',
      array['sede de válvula','válvula','vedação','fluido','pressão','desenho']::text[],
      'https://wayflex.ind.br/acessorios',
      null
    )
), inserted_documents as (
  insert into public.documents (
    organization_id, name, content_text, type, status, source_type, source_url,
    category, visibility, metadata
  )
  select
    target.organization_id,
    entries.name,
    entries.content_text,
    'text/markdown',
    'active',
    'url',
    entries.source_url || '#ana-' || entries.source_key,
    'knowledge',
    'ai',
    jsonb_strip_nulls(jsonb_build_object(
      'ana_memory', true,
      'memory_version', 'wayflex_public_catalog_v2_2026_09_10',
      'source_key', entries.source_key,
      'category', entries.memory_category,
      'keywords', to_jsonb(entries.keywords),
      'tags', to_jsonb(entries.keywords),
      'kind', 'link',
      'organization', 'Wayflex',
      'status', 'aprovado',
      'approval_basis', 'conteudo_publico_solicitado_pelo_responsavel',
      'source', 'site_oficial_wayflex',
      'source_label', 'Site oficial Wayflex',
      'source_url', entries.source_url,
      'image_alt', entries.image_alt,
      'reviewed_at', '2026-09-10',
      'priority', 'alta'
    ))
  from memory_entries entries
  cross join target
  where not exists (
    select 1
    from public.documents existing
    where existing.organization_id = target.organization_id
      and existing.metadata ->> 'memory_version' = 'wayflex_public_catalog_v2_2026_09_10'
      and existing.metadata ->> 'source_key' = entries.source_key
  )
  returning id, organization_id, content_text, status, metadata
)
insert into public.knowledge_chunks (
  organization_id, document_id, chunk_index, content, tokens, status, metadata
)
select
  organization_id,
  id,
  0,
  content_text,
  ceil(length(content_text)::numeric / 4)::integer,
  status,
  metadata
from inserted_documents;

commit;
