import { StationScreen } from "../../../../components/skyline/admin-lobby";
export default async function Page({ params }: { params: Promise<{ type: string }> }) { return <StationScreen type={(await params).type} />; }
