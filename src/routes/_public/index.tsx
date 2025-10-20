import { createFileRoute } from '@tanstack/react-router'
import { AWSStatusChecker } from '@/components/aws-status-checker'

export const Route = createFileRoute('/_public/')({
  component: Index,
})

function Index() {
  return <AWSStatusChecker />
}
