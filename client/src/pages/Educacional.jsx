import { usePermissao } from '../hooks/usePermissao'

const TRILHAS = [
  {
    titulo: 'Dominando o ImpulsoLead',
    descricao: 'Funcionalidades do CRM na prática: distribuição, funil, apresentações, follow-up.',
  },
  {
    titulo: 'Atendimento que Converte',
    descricao: 'Atendimento de lead no WhatsApp por padrão de imóvel (baixo, médio e alto padrão).',
  },
  {
    titulo: 'Posicionamento de Marca',
    descricao: 'Construção de autoridade e presença que faz o cliente escolher você.',
  },
  {
    titulo: 'Tráfego Pago para Imobiliárias',
    descricao: 'Fundamentos de anúncio que geram lead qualificado.',
  },
]

// TODO: religar este bloqueio quando houver conteúdo real — hoje todos veem "Em breve" (Opção B)
const GATE_ATIVO = false

export default function Educacional() {
  const podeEducacional = usePermissao('educacional')

  if (GATE_ATIVO && !podeEducacional) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-6" style={{ color: '#F1F5F9' }}>Educacional</h1>
        <div style={{ position: 'relative', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, zIndex: 10 }} />
          <div style={{ position: 'relative', zIndex: 20, textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h3 style={{ color: '#F1F5F9', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Conteúdo Educacional disponível em um plano superior
            </h3>
            <p style={{ color: '#94A3B8', marginBottom: 20, fontSize: 14 }}>Entre em contato com o suporte para fazer upgrade.</p>
            <a
              href="https://wa.me/5598981444954"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', backgroundColor: '#25D366', color: '#fff', fontWeight: 700, padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}
            >
              Falar com suporte
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Educacional</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>Trilhas de formação para você e sua equipe</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TRILHAS.map((t) => (
          <div key={t.titulo} className="card" style={{ padding: '1.25rem', position: 'relative' }}>
            <span
              className="badge"
              style={{ position: 'absolute', top: 16, right: 16, color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.15)' }}
            >
              Em breve
            </span>
            <h3 style={{ color: '#F1F5F9', fontSize: 16, fontWeight: 700, marginBottom: 6, paddingRight: 70 }}>{t.titulo}</h3>
            <p style={{ color: '#94A3B8', fontSize: 13.5, lineHeight: 1.5 }}>{t.descricao}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
